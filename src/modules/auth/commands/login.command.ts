import { v4 as uuidv4 } from 'uuid';
import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import type {
  IPasswordHasher,
  ITokenProvider,
  ISessionStore,
} from '../interfaces/IAuth.interface.js';
import { User } from '../../user/entity/user.entity.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { I18nService } from 'nestjs-i18n';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { hashToken } from '../utils/hashToken.util.js';
import { UserLoggedInEvent } from '../events/domain.events.js';
import type {
  IAuthCommand,
  LoginCommandInput,
  AuthResult,
} from '../interfaces/IAuthCommands.interface.js';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class LoginCommand implements IAuthCommand<
  LoginCommandInput,
  AuthResult
> {
  constructor(
    @Inject('USER_REPOSITORY') private readonly userRepo: Repository<User>,
    @Inject('PASSWORD_HASHER') private readonly passwordHasher: IPasswordHasher,
    @Inject('TOKEN_PROVIDER') private readonly tokenProvider: ITokenProvider,
    @Inject('SESSION_STORE') private readonly sessionStore: ISessionStore,
    private readonly i18n: I18nService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: LoginCommandInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user || !user.passwordHash)
      throw new BadRequestException(this.i18n.t('user.INVALID_CREDENTIALS'));

    const isValidPassword = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      this.logger.warn(`Failed login attempt for: ${email}`, 'LoginCommand');
      throw new UnauthorizedException(this.i18n.t('user.INVALID_CREDENTIALS'));
    }

    const tokens = await this.createSession(user);

    this.eventEmitter.emit(
      'user.logged_in',
      new UserLoggedInEvent(user.id, user.email),
    );

    this.logger.log(`User logged in: ${user.email}`, 'LoginCommand');

    return { user, ...tokens };
  }

  private async createSession(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = uuidv4();
    const permissions = rolePermissionsMap[user.role] || [];

    const tokens = await this.tokenProvider.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions,
      sessionId,
    });

    await this.sessionStore.createSession(
      user.id,
      sessionId,
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId,
        createdAt: new Date(),
      },
      tokens.expiresIn,
    );

    await this.sessionStore.storeRefreshToken(
      hashToken(tokens.refreshToken),
      user.id,
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return tokens;
  }
}
