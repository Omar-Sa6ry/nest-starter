import { Injectable } from '@nestjs/common';
import { AuthPayloadType } from './dtos/auth.dto.js';
import { RegisterCommand } from './commands/register.command.js';
import { LoginCommand } from './commands/login.command.js';
import { ForgetPasswordCommand } from './commands/forget-password.command.js';
import { ResetPasswordCommand } from './commands/reset-password.command.js';
import { RefreshTokenCommand } from './commands/refresh-token.command.js';
import { LogoutCommand } from './commands/logout.command.js';
import {
  RegisterCommandInput,
  LoginCommandInput,
  ForgetPasswordCommandInput,
  ResetPasswordCommandInput,
  RefreshTokenCommandInput,
  LogoutCommandInput,
  toAuthPayload,
} from './interfaces/IAuthCommands.interface.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly registerCommand: RegisterCommand,
    private readonly loginCommand: LoginCommand,
    private readonly forgetPasswordCommand: ForgetPasswordCommand,
    private readonly resetPasswordCommand: ResetPasswordCommand,
    private readonly refreshTokenCommand: RefreshTokenCommand,
    private readonly logoutCommand: LogoutCommand,
  ) {}

  async register(input: RegisterCommandInput): Promise<AuthPayloadType> {
    const result = await this.registerCommand.execute(input);
    return toAuthPayload(result.user, result.accessToken, result.refreshToken);
  }

  async login(input: LoginCommandInput): Promise<AuthPayloadType> {
    const result = await this.loginCommand.execute(input);
    return toAuthPayload(result.user, result.accessToken, result.refreshToken);
  }

  async forgetPassword(input: ForgetPasswordCommandInput): Promise<void> {
    return this.forgetPasswordCommand.execute(input);
  }

  async resetPassword(input: ResetPasswordCommandInput): Promise<void> {
    return this.resetPasswordCommand.execute(input);
  }

  async refreshToken(input: RefreshTokenCommandInput): Promise<AuthPayloadType> {
    const result = await this.refreshTokenCommand.execute(input);
    return toAuthPayload(result.user, result.accessToken, result.refreshToken);
  }

  async logout(input: LogoutCommandInput): Promise<void> {
    return this.logoutCommand.execute(input);
  }
}