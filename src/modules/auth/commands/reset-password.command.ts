import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { IPasswordHasher, ISessionStore } from '../../../common/interfaces/ISecurity.interface.js';
import type { IRedisAdapter } from '../interfaces/IAuth.interface.js';
import { User } from '../../user/entity/user.entity.js';
import { I18nService } from 'nestjs-i18n';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { PasswordResetCompletedEvent } from '../events/domain.events.js';
import type {
  IAuthCommand,
  ResetPasswordCommandInput,
} from '../interfaces/IAuthCommands.interface.js';

const RESET_TOKEN_KEY_PREFIX = 'password_reset:token:';
const RESET_USER_KEY_PREFIX = 'password_reset:user:';

@Injectable()
export class ResetPasswordCommand implements IAuthCommand<ResetPasswordCommandInput, void> {
  constructor(
    @Inject('PASSWORD_HASHER') private readonly passwordHasher: IPasswordHasher,
    @Inject('SESSION_STORE') private readonly sessionStore: ISessionStore,
    @Inject('REDIS_ADAPTER') private readonly redis: IRedisAdapter,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: ResetPasswordCommandInput): Promise<void> {
    const resetRecord = await this.redis.get<{ userId: string }>(`${RESET_TOKEN_KEY_PREFIX}${input.token}`);
    if (!resetRecord) {
      throw new BadRequestException(this.i18n.t('user.INVALID_RESET_TOKEN'));
    }

    const hashedPassword = await this.passwordHasher.hash(input.passwordNew);

    await this.dataSource.transaction(async (em) => {
      const userRepo = em.getRepository(User);
      const user = await userRepo.findOne({ where: { id: resetRecord.userId } });

      if (!user) {
        throw new BadRequestException(this.i18n.t('user.INVALID_RESET_TOKEN'));
      }

      user.passwordHash = hashedPassword;
      await userRepo.save(user);
    });

    await this.redis.del(`${RESET_TOKEN_KEY_PREFIX}${input.token}`);
    await this.redis.del(`${RESET_USER_KEY_PREFIX}${resetRecord.userId}`);

    await this.sessionStore.revokeAllUserSessions(resetRecord.userId);

    this.eventEmitter.emit(
      'password.reset_completed',
      new PasswordResetCompletedEvent(resetRecord.userId),
    );

    this.logger.log(`Password reset completed for user: ${resetRecord.userId}`, 'ResetPasswordCommand');
  }
}