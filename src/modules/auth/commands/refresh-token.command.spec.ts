import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../user/entity/user.entity.js';
import { Role } from '../../../common/constant/enum.constant.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { RefreshTokenCommand } from './refresh-token.command.js';
import type {
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { I18nService } from 'nestjs-i18n';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

describe('RefreshTokenCommand', () => {
  let command: RefreshTokenCommand;
  let mockUserRepo: Mocked<Repository<User>>;
  let mockTokenProvider: ITokenProvider;
  let mockSessionStore: ISessionStore;
  let mockI18n: Mocked<I18nService>;
  let mockLogger: StructuredLogger;

  const sampleUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '',
    role: Role.USER,
    isActive: true,
    imageUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleTokens = {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 86400,
  };

  const validPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    permissions: rolePermissionsMap[Role.USER],
    sessionId: 'session-1',
  };

  const validSession = {
    userId: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    sessionId: 'session-1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn<Repository<User>['findOne']>(),
    } as unknown as Mocked<Repository<User>>;

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
      revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
      blacklistToken: vi.fn(),
      isTokenBlacklisted: vi.fn(),
    };

    mockI18n = {
      t: vi.fn().mockImplementation((key: string) => key),
    } as unknown as Mocked<I18nService>;

    mockLogger = new StructuredLogger();
    vi.spyOn(mockLogger, 'log').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'error').mockImplementation(() => undefined);

    command = new RefreshTokenCommand(
      mockUserRepo,
      mockTokenProvider,
      mockSessionStore,
      mockI18n,
      mockLogger,
    );
  });

  describe('execute', () => {
    it('throws UnauthorizedException for invalid refresh token', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue(null);

      await expect(
        command.execute({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when refresh token has no sessionId', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue({
        ...validPayload,
        sessionId: undefined,
      });

      await expect(
        command.execute({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when session not found', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue(
        validPayload,
      );
      vi.mocked(mockSessionStore.getSession).mockResolvedValue(null);

      await expect(
        command.execute({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when stored refresh owner mismatches', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue(
        validPayload,
      );
      vi.mocked(mockSessionStore.getSession).mockResolvedValue(validSession);
      vi.mocked(mockSessionStore.getUserIdByRefreshToken).mockResolvedValue(
        'other-user',
      );

      await expect(
        command.execute({ refreshToken: 'stolen-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user no longer exists', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue(
        validPayload,
      );
      vi.mocked(mockSessionStore.getSession).mockResolvedValue(validSession);
      vi.mocked(mockSessionStore.getUserIdByRefreshToken).mockResolvedValue(
        'user-1',
      );
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        command.execute({ refreshToken: 'old-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates tokens on successful refresh', async () => {
      vi.mocked(mockTokenProvider.verifyRefreshToken).mockResolvedValue(
        validPayload,
      );
      vi.mocked(mockSessionStore.getSession).mockResolvedValue(validSession);
      vi.mocked(mockSessionStore.getUserIdByRefreshToken).mockResolvedValue(
        'user-1',
      );
      mockUserRepo.findOne.mockResolvedValue(sampleUser);

      const result = await command.execute({
        refreshToken: 'old-refresh-token',
      });

      expect(mockSessionStore.revokeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
      );
      expect(mockTokenProvider.generateTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          email: 'test@example.com',
          role: Role.USER,
          permissions: rolePermissionsMap[Role.USER],
          sessionId: 'session-1',
        }),
      );
      expect(mockSessionStore.createSession).toHaveBeenCalled();
      expect(mockSessionStore.storeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        'user-1',
        REFRESH_TOKEN_TTL_SECONDS,
      );
      expect(result.user.id).toBe('user-1');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });
  });
});
