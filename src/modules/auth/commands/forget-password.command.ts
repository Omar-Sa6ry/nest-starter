import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { randomInt } from 'crypto';
import { PasswordResetRequestedEvent } from '../events/domain.events.js';
import * as IAuthInterface from '../interfaces/IAuth.interface.js';
import { IAuthCommand, ForgetPasswordCommandInput } from '../interfaces/IAuthCommands.interface.js';
import { User } from '../../user/entity/user.entity.js';
import { AUTH_I18N } from '../constants/auth-i18n.constants.js';

const RESET_TOKEN_TTL_SECONDS = 15 * 60;
const RESET_TOKEN_KEY_PREFIX = 'password_reset:token:';
const RESET_USER_KEY_PREFIX = 'password_reset:user:';

@Injectable()
export class ForgetPasswordCommand implements IAuthCommand<
  ForgetPasswordCommandInput,
  void
> {
  constructor(
    @Inject('USER_REPOSITORY') private readonly userRepo: Repository<User>,
    @Inject('REDIS_ADAPTER') private readonly redis: IAuthInterface.IRedisAdapter,
    @Inject('NOTIFICATION_ADAPTER')
    private readonly notification: IAuthInterface.INotificationAdapter,

    private readonly i18n: I18nService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: ForgetPasswordCommandInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      return;
    }

    const token = randomInt(100000, 1000000).toString();

    const previousToken = await this.redis.get<string>(
      `${RESET_USER_KEY_PREFIX}${user.id}`,
    );
    if (previousToken) {
      await this.redis.del(`${RESET_TOKEN_KEY_PREFIX}${previousToken}`);
    }

    await this.redis.set(
      `${RESET_TOKEN_KEY_PREFIX}${token}`,
      { userId: user.id },
      RESET_TOKEN_TTL_SECONDS,
    );
    await this.redis.set(
      `${RESET_USER_KEY_PREFIX}${user.id}`,
      token,
      RESET_TOKEN_TTL_SECONDS,
    );

    this.eventEmitter.emit(
      'password.reset_requested',
      new PasswordResetRequestedEvent(user.id, user.email),
    );

    await this.notification
      .sendEmail(
        user.email,
        this.i18n.t(AUTH_I18N.PASSWORD_RESET_SUBJECT),
        this.i18n.t(AUTH_I18N.PASSWORD_RESET_BODY),
        { name: user.firstName, token },
      )
      .catch((err) => {
        this.logger.error(
          `Failed to send reset password email to ${user.email}: ${err?.message ?? err}`,
          err instanceof Error ? err.stack : undefined,
          'ForgetPasswordCommand',
        );
      });

    this.logger.log(
      `Password reset requested for: ${email}`,
      'ForgetPasswordCommand',
    );
  }
}
