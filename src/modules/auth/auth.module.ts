import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { NotificationModule } from '@bts-soft/core';
import { AuthService } from './auth.service.js';
import { AuthResolver } from './auth.resolver.js';
import { UserFactory } from './factory/user.factory.js';
import { DomainEventHandler } from './events/domain-event.handler.js';
import { UserModule } from '../user/user.module.js';
import { RedisAdapter, REDIS_ADAPTER } from './adapters/redis.adapter.js';
import {
  NotificationAdapter,
  NOTIFICATION_ADAPTER,
} from './adapters/notification.adapter.js';
import { RegisterCommand } from './commands/register.command.js';
import { LoginCommand } from './commands/login.command.js';
import { ForgetPasswordCommand } from './commands/forget-password.command.js';
import { ResetPasswordCommand } from './commands/reset-password.command.js';
import { RefreshTokenCommand } from './commands/refresh-token.command.js';
import { LogoutCommand } from './commands/logout.command.js';
import { OAuthController } from './oauth/oauth.controller.js';
import { OAuthService } from './oauth/oauth.service.js';
import { GoogleStrategy } from './oauth/strategies/google.strategy.js';

@Module({
  imports: [
    UserModule,
    NotificationModule,
    PassportModule.register({ session: false }),
  ],
  controllers: [OAuthController],
  providers: [
    AuthService,
    AuthResolver,
    UserFactory,
    DomainEventHandler,

    RegisterCommand,
    LoginCommand,
    ForgetPasswordCommand,
    ResetPasswordCommand,
    RefreshTokenCommand,
    LogoutCommand,

    OAuthService,
    GoogleStrategy,

    {
      provide: REDIS_ADAPTER,
      useClass: RedisAdapter,
    },
    {
      provide: NOTIFICATION_ADAPTER,
      useClass: NotificationAdapter,
    },
  ],
  exports: [AuthService, OAuthService],
})
export class AuthModule {}
