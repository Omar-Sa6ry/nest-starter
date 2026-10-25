import { User } from "../../user/entity/user.entity.js";
import { AuthPayloadType } from "../dtos/auth.dto.js";

export interface IAuthCommand<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

export interface RegisterCommandInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  imageUrl?: string;
}

export interface LoginCommandInput {
  email: string;
  password: string;
}

export interface ForgetPasswordCommandInput {
  email: string;
}

export interface ResetPasswordCommandInput {
  token: string;
  passwordNew: string;
}

export interface RefreshTokenCommandInput {
  refreshToken: string;
}

export interface LogoutCommandInput {
  userId: string;
  sessionId: string;
  accessToken?: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

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
      updatedAt:user.updatedAt,
      imageUrl: user.imageUrl,
    },
    accessToken,
    refreshToken,
  };
}