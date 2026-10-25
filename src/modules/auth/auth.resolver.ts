import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { AuthResponse } from './dtos/auth.dto.js';
import {
  RegisterInput,
  LoginInput,
  ForgetPasswordInput,
  ResetPasswordInput,
  RefreshTokenInput,
} from './inputs/auth.input.js';
import { BooleanResponse } from '../../common/graphql/general-response.type.js';
import { AuthService } from './auth.service.js';
import { RoleGuard } from '../../common/guard/role.guard.js';
import { RateLimit, RateLimiterAlgorithm, CurrentUser } from '@bts-soft/core';
import { UseGuards } from '@nestjs/common';
import type {
  IAuthenticatedUser,
  IGraphQLContext,
} from '../../common/interfaces/IContext.interface.js';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  @Mutation(() => AuthResponse)
  @RateLimit({
    algorithm: RateLimiterAlgorithm.SLIDING_WINDOW_COUNTER,
    limit: 5,
    windowMs: 60000,
  })
  async register(@Args('input') input: RegisterInput): Promise<AuthResponse> {
    const data = await this.authService.register(input);
    return {
      success: true,
      statusCode: 201,
      message: await this.i18n.t('user.REGISTER_SUCCESS'),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => AuthResponse)
  @RateLimit({
    algorithm: RateLimiterAlgorithm.SLIDING_WINDOW_COUNTER,
    limit: 10,
    windowMs: 60000,
  })
  async login(@Args('input') input: LoginInput): Promise<AuthResponse> {
    const data = await this.authService.login(input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.LOGIN_SUCCESS'),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => BooleanResponse)
  @RateLimit({
    algorithm: RateLimiterAlgorithm.SLIDING_WINDOW_COUNTER,
    limit: 3,
    windowMs: 60000,
  })
  async forgetPassword(
    @Args('input') input: ForgetPasswordInput,
  ): Promise<BooleanResponse> {
    await this.authService.forgetPassword(input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.FORGET_PASSWORD_SUCCESS'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @RateLimit({
    algorithm: RateLimiterAlgorithm.SLIDING_WINDOW_COUNTER,
    limit: 3,
    windowMs: 60000,
  })
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<BooleanResponse> {
    await this.authService.resetPassword(input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.RESET_PASSWORD_SUCCESS'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @UseGuards(RoleGuard)
  async logout(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Context() context: IGraphQLContext,
  ): Promise<BooleanResponse> {
    const authHeader = context.req?.headers?.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    await this.authService.logout({
      userId: currentUser.id,
      sessionId: currentUser.sessionId ?? '',
      accessToken,
    });
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.LOGOUT_SUCCESS'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => AuthResponse)
  @RateLimit({
    algorithm: RateLimiterAlgorithm.SLIDING_WINDOW_COUNTER,
    limit: 10,
    windowMs: 60000,
  })
  async refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<AuthResponse> {
    const data = await this.authService.refreshToken(input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.REFRESH_TOKEN_SUCCESS'),
      timeStamp: new Date().toISOString(),
      data,
    };
  }
}
