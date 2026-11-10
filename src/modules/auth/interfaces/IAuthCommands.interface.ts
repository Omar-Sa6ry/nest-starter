import { User } from "../../user/entity/user.entity.js";
import { AuthPayloadType } from "../dtos/auth.dto.js";

export interface IAuthCommand<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

export interface IRegisterCommandInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  imageUrl?: string;
}

export interface ILoginCommandInput {
  email: string;
  password: string;
}

export interface IForgetPasswordCommandInput {
  email: string;
}

export interface IResetPasswordCommandInput {
  token: string;
  passwordNew: string;
}

export interface IRefreshTokenCommandInput {
  refreshToken: string;
}

export interface ILogoutCommandInput {
  userId: string;
  sessionId: string;
  accessToken?: string;
}

export interface IAuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Backward-compatible type aliases
export type RegisterCommandInput = IRegisterCommandInput;
export type LoginCommandInput = ILoginCommandInput;
export type ForgetPasswordCommandInput = IForgetPasswordCommandInput;
export type ResetPasswordCommandInput = IResetPasswordCommandInput;
export type RefreshTokenCommandInput = IRefreshTokenCommandInput;
export type LogoutCommandInput = ILogoutCommandInput;
export type AuthResult = IAuthResult;

export function toAuthPayload(user: User, accessToken: string, refreshToken: string): AuthPayloadType {
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      imageUrl: user.imageUrl,
    },
    accessToken,
    refreshToken,
  };
}
