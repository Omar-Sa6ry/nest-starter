import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Role } from '../../../common/constant/enum.constant.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { LoginCommand } from './login.command.js';
import type {
  IPasswordHasher,
  ITokenProvider,
  ISessionStore,
} from '../interfaces/IAuth.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { I18nService } from 'nestjs-i18n';
import { UserLoggedInEvent } from '../events/domain.events.js';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

describe('LoginCommand', () => {
  let command: LoginCommand;
  let mockUserRepo: Repository<any>;
  let mockPasswordHasher: IPasswordHasher;
  let mockTokenProvider: ITokenProvider;
  let mockSessionStore: ISessionStore;
  let mockI18n: I18nService;
  let mockEventEmitter: EventEmitter2;
  let mockLogger: StructuredLogger;

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
    } as any;

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

    mockSessionStore = {
      createSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      storeRefreshToken: vi.fn().mockResolvedValue(undefined),
      getUserIdByRefreshToken: vi.fn().mockResolvedValue('user-1'),
      revokeRefreshToken: vi.fn(),
      blacklistToken: vi.fn(),
    };

    mockI18n = {
      t: vi.fn().mockImplementation((key: string) => key),
    } as any;

    mockEventEmitter = {
      emit: vi.fn(),
    } as any;

    mockLogger = new StructuredLogger();
    vi.spyOn(mockLogger, 'log').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'error').mockImplementation(() => undefined);

    command = new LoginCommand(
      mockUserRepo,
      mockPasswordHasher,
      mockTokenProvider,
      mockSessionStore,
      mockI18n,
      mockEventEmitter,
      mockLogger,
    );
  });

  describe('execute', () => {
    it('throws BadRequestException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        command.execute({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      vi.mocked(mockPasswordHasher.compare).mockResolvedValue(false);

      await expect(
        command.execute({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed login attempt for: test@example.com',
        'LoginCommand',
      );
    });

    it('returns tokens on successful login', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);

      const result = await command.execute({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockPasswordHasher.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );
      expect(mockTokenProvider.generateTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          email: 'test@example.com',
          role: Role.USER,
          permissions: rolePermissionsMap[Role.USER],
        }),
      );
      expect(mockSessionStore.createSession).toHaveBeenCalled();
      expect(mockSessionStore.storeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        'user-1',
        REFRESH_TOKEN_TTL_SECONDS,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_in',
        expect.any(UserLoggedInEvent),
      );
      expect(result.user.id).toBe('user-1');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('normalizes email to lowercase and trims', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);

      await command.execute({
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
      });

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });
});
