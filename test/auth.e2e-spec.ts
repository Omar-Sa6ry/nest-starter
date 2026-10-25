import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { RegisterCommand } from '../src/modules/auth/commands/register.command.js';
import { LoginCommand } from '../src/modules/auth/commands/login.command.js';
import { ForgetPasswordCommand } from '../src/modules/auth/commands/forget-password.command.js';
import { ResetPasswordCommand } from '../src/modules/auth/commands/reset-password.command.js';
import { RefreshTokenCommand } from '../src/modules/auth/commands/refresh-token.command.js';
import { LogoutCommand } from '../src/modules/auth/commands/logout.command.js';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { IPasswordHasher, ITokenProvider, ISessionStore } from '../src/common/interfaces/ISecurity.interface.js';
import { UserFactory } from '../src/modules/auth/factory/user.factory.js';
import { Role } from '../src/common/constant/enum.constant.js';
import { StructuredLogger } from '../src/common/logging/logger.service.js';

describe('AuthService (e2e) - New Architecture', () => {
  let service: AuthService;
  let mockUserRepo: {
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let mockPasswordHasher: IPasswordHasher;
  let mockTokenProvider: ITokenProvider;
  let mockSessionRepo: ISessionStore;
  let mockUserFactory: UserFactory;
  let mockI18n: { t: ReturnType<typeof vi.fn> };
  let mockRedis: Record<string, ReturnType<typeof vi.fn>>;
  let mockDataSource: Record<string, ReturnType<typeof vi.fn>>;
  let mockEventEmitter: { emit: ReturnType<typeof vi.fn> };
  let mockNotificationService: { send: ReturnType<typeof vi.fn> };

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

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn(),
      count: vi.fn(),
      save: vi.fn(),
    };
    mockPasswordHasher = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      compare: vi.fn().mockResolvedValue(true),
    };
    mockTokenProvider = {
      generateTokens: vi.fn().mockResolvedValue(sampleTokens),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
      getJti: vi.fn().mockResolvedValue('jti-1'),
    };
    mockSessionRepo = {
      createSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn(),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
      blacklistToken: vi.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: vi.fn(),
      storeRefreshToken: vi.fn().mockResolvedValue(undefined),
      getUserIdByRefreshToken: vi.fn().mockResolvedValue('user-1'),
      revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    };
    mockUserFactory = {
      createUser: vi.fn().mockReturnValue(sampleUser),
    } as unknown as UserFactory;
    mockI18n = { t: vi.fn().mockImplementation((key: string) => key) };
    mockRedis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };
    mockDataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn({ getRepository: () => mockUserRepo })),
    };
    mockEventEmitter = { emit: vi.fn() };
    mockNotificationService = { send: vi.fn().mockResolvedValue(undefined) };

    // Create commands with all dependencies
    const registerCommand = new RegisterCommand(
      mockUserFactory,
      mockPasswordHasher,
      mockTokenProvider,
      mockSessionRepo,
      mockDataSource as any,
      mockI18n as any,
      mockEventEmitter as any,
      new StructuredLogger(),
    );

    const loginCommand = new LoginCommand(
      mockUserRepo as any,
      mockPasswordHasher,
      mockTokenProvider,
      mockSessionRepo,
      mockI18n as any,
      mockEventEmitter as any,
      new StructuredLogger(),
    );

    const forgetPasswordCommand = new ForgetPasswordCommand(
      mockUserRepo as any,
      { get: mockRedis.get, set: mockRedis.set, del: mockRedis.del } as any,
      { sendEmail: mockNotificationService.send } as any,
      mockI18n as any,
      mockEventEmitter as any,
      new StructuredLogger(),
    );

    const resetPasswordCommand = new ResetPasswordCommand(
      mockPasswordHasher,
      mockSessionRepo,
      { get: mockRedis.get, set: mockRedis.set, del: mockRedis.del } as any,
      mockDataSource as any,
      mockI18n as any,
      mockEventEmitter as any,
      new StructuredLogger(),
    );

    const refreshTokenCommand = new RefreshTokenCommand(
      mockUserRepo as any,
      mockTokenProvider,
      mockSessionRepo,
      mockI18n as any,
      new StructuredLogger(),
    );

    const logoutCommand = new LogoutCommand(
      mockTokenProvider,
      mockSessionRepo,
      mockEventEmitter as any,
      new StructuredLogger(),
    );

    service = new AuthService(
      registerCommand,
      loginCommand,
      forgetPasswordCommand,
      resetPasswordCommand,
      refreshTokenCommand,
      logoutCommand,
    );
  });

  describe('register', () => {
    it('throws BadRequestException when email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates user, session, stores refresh token, and emits event on success', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(0);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(mockUserFactory.createUser).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockSessionRepo.createSession).toHaveBeenCalled();
      expect(mockSessionRepo.storeRefreshToken).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.registered',
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe('user-1');
    });

    it('assigns ADMIN role to first user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(0);
      mockUserRepo.save.mockResolvedValue({ ...sampleUser, role: Role.ADMIN });

      const result = await service.register({
        email: 'first@example.com',
        password: 'password123',
        firstName: 'First',
        lastName: 'Admin',
      });

      expect(result.user.role).toBe(Role.ADMIN);
    });
  });

  describe('login', () => {
    it('throws BadRequestException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      vi.mocked(mockPasswordHasher.compare).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens on successful login', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockSessionRepo.createSession).toHaveBeenCalled();
      expect(mockSessionRepo.storeRefreshToken).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_in',
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('logout', () => {
    it('revokes session and blacklists token', async () => {
      await service.logout({
        userId: 'user-1',
        sessionId: 'session-1',
        accessToken: 'access-token',
      });

      expect(mockSessionRepo.revokeSession).toHaveBeenCalledWith('user-1', 'session-1');
      expect(mockTokenProvider.getJti).toHaveBeenCalledWith('access-token');
      expect(mockSessionRepo.blacklistToken).toHaveBeenCalledWith('jti-1', expect.any(Number));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_out',
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('skips blacklist when no access token provided', async () => {
      await service.logout({ userId: 'user-1', sessionId: 'session-1' });

      expect(mockSessionRepo.revokeSession).toHaveBeenCalled();
      expect(mockSessionRepo.blacklistToken).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('throws UnauthorizedException for invalid refresh token', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when session not found', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue({
        userId: 'user-1',
        email: '',
        role: '',
        permissions: [],
        sessionId: 'session-1',
      });
      vi.mocked(mockSessionRepo.getSession).mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates tokens on successful refresh', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue({
        userId: 'user-1',
        email: '',
        role: '',
        permissions: [],
        sessionId: 'session-1',
      });
      vi.mocked(mockSessionRepo.getSession).mockResolvedValue({
        userId: 'user-1',
        email: 'test@example.com',
        role: Role.USER,
        sessionId: 'session-1',
        createdAt: new Date(),
      });
      vi.mocked(mockSessionRepo.getUserIdByRefreshToken).mockResolvedValue('user-1');
      mockUserRepo.findOne.mockResolvedValue(sampleUser);

      const result = await service.refreshToken({
        refreshToken: 'old-refresh-token',
      });

      expect(mockSessionRepo.revokeRefreshToken).toHaveBeenCalled();
      expect(mockSessionRepo.storeRefreshToken).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('forgetPassword', () => {
    it('stores reset token in Redis', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockRedis.get.mockResolvedValue(null);

      await service.forgetPassword({ email: 'test@example.com' });

      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.reset_requested',
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('silently returns when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.forgetPassword({ email: 'nonexistent@example.com' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: '123456', passwordNew: 'newpass' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password and revokes sessions on valid token', async () => {
      mockRedis.get.mockResolvedValue({ userId: 'user-1' });
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      await service.resetPassword({ token: '123456', passwordNew: 'newpass' });

      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockSessionRepo.revokeAllUserSessions).toHaveBeenCalledWith('user-1');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.reset_completed',
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });
});