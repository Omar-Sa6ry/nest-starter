import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterCommand } from './commands/register.command.js';
import { LoginCommand } from './commands/login.command.js';
import { ForgetPasswordCommand } from './commands/forget-password.command.js';
import { ResetPasswordCommand } from './commands/reset-password.command.js';
import { RefreshTokenCommand } from './commands/refresh-token.command.js';
import { LogoutCommand } from './commands/logout.command.js';
import { Role } from '../../common/constant/enum.constant.js';

describe('AuthService', () => {
  let service: AuthService;
  let mockRegisterCommand: RegisterCommand;
  let mockLoginCommand: LoginCommand;
  let mockForgetPasswordCommand: ForgetPasswordCommand;
  let mockResetPasswordCommand: ResetPasswordCommand;
  let mockRefreshTokenCommand: RefreshTokenCommand;
  let mockLogoutCommand: LogoutCommand;

  const sampleUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '',
    role: Role.USER,
    isActive: true,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 86400,
  };

  const authResult = {
    user: sampleUser,
    ...sampleTokens,
  };

  beforeEach(() => {
    mockRegisterCommand = {
      execute: vi.fn().mockResolvedValue(authResult),
    } as any;

    mockLoginCommand = {
      execute: vi.fn().mockResolvedValue(authResult),
    } as any;

    mockForgetPasswordCommand = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockResetPasswordCommand = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockRefreshTokenCommand = {
      execute: vi.fn().mockResolvedValue(authResult),
    } as any;

    mockLogoutCommand = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as any;

    service = new AuthService(
      mockRegisterCommand,
      mockLoginCommand,
      mockForgetPasswordCommand,
      mockResetPasswordCommand,
      mockRefreshTokenCommand,
      mockLogoutCommand,
    );
  });

  describe('register', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '01234567890',
      imageUrl: 'https://example.com/img.png',
    };

    it('delegates to RegisterCommand and returns AuthPayloadType', async () => {
      const result = await service.register(validInput);

      expect(mockRegisterCommand.execute).toHaveBeenCalledWith(validInput);
      expect(result).toEqual({
        user: {
          id: sampleUser.id,
          email: sampleUser.email,
          firstName: sampleUser.firstName,
          lastName: sampleUser.lastName,
          role: sampleUser.role,
          isActive: sampleUser.isActive,
          createdAt: sampleUser.createdAt,
          updatedAt: sampleUser.updatedAt,
          imageUrl: sampleUser.imageUrl,
        },
        accessToken: sampleTokens.accessToken,
        refreshToken: sampleTokens.refreshToken,
      });
    });

    it('propagates BadRequestException from command', async () => {
      mockRegisterCommand.execute.mockRejectedValue(new BadRequestException('Email exists'));

      await expect(service.register(validInput)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('delegates to LoginCommand and returns AuthPayloadType', async () => {
      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockLoginCommand.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('propagates UnauthorizedException from command', async () => {
      mockLoginCommand.execute.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(service.login({
        email: 'test@example.com',
        password: 'wrong',
      })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgetPassword', () => {
    it('delegates to ForgetPasswordCommand', async () => {
      await service.forgetPassword({ email: 'test@example.com' });

      expect(mockForgetPasswordCommand.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('propagates exceptions from command', async () => {
      mockForgetPasswordCommand.execute.mockRejectedValue(new Error('Redis error'));

      await expect(service.forgetPassword({ email: 'test@example.com' })).rejects.toThrow('Redis error');
    });
  });

  describe('resetPassword', () => {
    it('delegates to ResetPasswordCommand', async () => {
      await service.resetPassword({ token: '123456', passwordNew: 'newpass' });

      expect(mockResetPasswordCommand.execute).toHaveBeenCalledWith({
        token: '123456',
        passwordNew: 'newpass',
      });
    });

    it('propagates BadRequestException from command', async () => {
      mockResetPasswordCommand.execute.mockRejectedValue(new BadRequestException('Invalid token'));

      await expect(service.resetPassword({ token: '123456', passwordNew: 'newpass' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('delegates to RefreshTokenCommand and returns AuthPayloadType', async () => {
      const result = await service.refreshToken({ refreshToken: 'old-refresh-token' });

      expect(mockRefreshTokenCommand.execute).toHaveBeenCalledWith({
        refreshToken: 'old-refresh-token',
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('propagates UnauthorizedException from command', async () => {
      mockRefreshTokenCommand.execute.mockRejectedValue(new UnauthorizedException('Invalid token'));

      await expect(service.refreshToken({ refreshToken: 'bad-token' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('delegates to LogoutCommand with all parameters', async () => {
      await service.logout({
        userId: 'user-1',
        sessionId: 'session-1',
        accessToken: 'access-token',
      });

      expect(mockLogoutCommand.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        sessionId: 'session-1',
        accessToken: 'access-token',
      });
    });

    it('delegates to LogoutCommand without access token', async () => {
      await service.logout({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(mockLogoutCommand.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        sessionId: 'session-1',
        accessToken: undefined,
      });
    });

    it('propagates exceptions from command', async () => {
      mockLogoutCommand.execute.mockRejectedValue(new Error('Session error'));

      await expect(service.logout({
        userId: 'user-1',
        sessionId: 'session-1',
      })).rejects.toThrow('Session error');
    });
  });
});