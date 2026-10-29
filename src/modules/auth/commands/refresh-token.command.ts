import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type {
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import { User } from '../../user/entity/user.entity.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { I18nService } from 'nestjs-i18n';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { hashToken } from '../utils/hashToken.util.js';
import type {
  IAuthCommand,
  RefreshTokenCommandInput,
  AuthResult,
} from '../interfaces/IAuthCommands.interface.js';
import { AUTH_I18N } from '../constants/auth-i18n.constants.js';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class RefreshTokenCommand implements IAuthCommand<RefreshTokenCommandInput, AuthResult> {
  constructor(
    @Inject('USER_REPOSITORY') private readonly userRepo: Repository<User>,
    @Inject('TOKEN_PROVIDER') private readonly tokenProvider: ITokenProvider,
    @Inject('SESSION_STORE') private readonly sessionStore: ISessionStore,
    private readonly i18n: I18nService,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: RefreshTokenCommandInput): Promise<AuthResult> {
    const payload = await this.tokenProvider.verifyRefreshToken(input.refreshToken);
    if (!payload || !payload.sessionId) {
      throw new UnauthorizedException(this.i18n.t(AUTH_I18N.INVALID_TOKEN));
    }

    const session = await this.sessionStore.getSession(payload.userId, payload.sessionId);
    if (!session) {
      throw new UnauthorizedException(this.i18n.t(AUTH_I18N.SESSION_EXPIRED));
    }

    const refreshTokenHash = hashToken(input.refreshToken);
    const storedUserId = await this.sessionStore.getUserIdByRefreshToken(refreshTokenHash);
    if (storedUserId !== payload.userId) {
      throw new UnauthorizedException(this.i18n.t(AUTH_I18N.INVALID_TOKEN));
    }

    this.logger.log(`Refresh token rotated for user: ${payload.userId}`, 'RefreshTokenCommand');

    const user = await this.userRepo.findOne({ where: { id: payload.userId } });
    if (!user) {
      throw new UnauthorizedException(this.i18n.t(AUTH_I18N.INVALID_TOKEN));
    }

    const tokens = await this.createSession(user, payload.sessionId, session.createdAt);

    await this.sessionStore.revokeRefreshToken(refreshTokenHash);

    return { user, ...tokens };
  }

  private async createSession(user: User, sessionId: string, createdAt: Date): Promise<{ accessToken: string; refreshToken: string }> {
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
        createdAt,
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