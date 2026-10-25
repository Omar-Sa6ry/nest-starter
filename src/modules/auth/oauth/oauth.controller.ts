import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service.js';
import type {
  ITokenProvider,
  ISessionStore,
} from '../interfaces/IAuth.interface.js';
import {
  TOKEN_PROVIDER,
  SESSION_STORE,
} from '../../../common/security/tokens/injection.tokens.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { hashToken } from '../utils/hashToken.util.js';
import { UserLoggedInEvent } from '../events/domain.events.js';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import type { GoogleUserData } from './interfaces/google.interface.js';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    @Inject(SESSION_STORE)
    private readonly sessionStore: ISessionStore,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport redirects to Google login
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const cleanFrontendUrl = frontendUrl.endsWith('/')
      ? frontendUrl.slice(0, -1)
      : frontendUrl;

    try {
      const googleUser = req.user as GoogleUserData;
      const user = await this.oauthService.validateUser(googleUser);

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

      this.eventEmitter.emit(
        'user.logged_in',
        new UserLoggedInEvent(user.id, user.email),
      );

      this.logger.log(
        `OAuth login successful for: ${user.email}`,
        'OAuthController',
      );

      const redirectUrl =
        `${cleanFrontendUrl}/auth/callback?` +
        `token=${tokens.accessToken}` +
        `&refreshToken=${tokens.refreshToken}` +
        `&email=${encodeURIComponent(user.email || '')}` +
        `&firstName=${encodeURIComponent(user.firstName || '')}` +
        `&lastName=${encodeURIComponent(user.lastName || '')}` +
        `&role=${encodeURIComponent(user.role || '')}` +
        `&id=${encodeURIComponent(user.id || '')}`;

      return res.redirect(redirectUrl);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `OAuth error: ${err?.message}`,
        err?.stack,
        'OAuthController',
      );
      const redirectUrl = `${cleanFrontendUrl}/auth/callback?error=${encodeURIComponent(
        err?.message || 'Authentication failed',
      )}`;
      return res.redirect(redirectUrl);
    }
  }
}
