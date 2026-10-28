import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';
import { User } from '../../user/entity/user.entity.js';
import { Role } from '../../../common/constant/enum.constant.js';
import { ResetPasswordCommand } from './reset-password.command.js';
import type {
  IPasswordHasher,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import type { IRedisAdapter } from '../interfaces/IAuth.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { I18nService } from 'nestjs-i18n';
import { PasswordResetCompletedEvent } from '../events/domain.events.js';

const RESET_TOKEN_KEY_PREFIX = 'password_reset:token:';
const RESET_USER_KEY_PREFIX = 'password_reset:user:';

describe('ResetPasswordCommand', () => {
  let command: ResetPasswordCommand;
  let mockUserRepo: Mocked<Repository<User>>;
  let mockPasswordHasher: IPasswordHasher;
  let mockSessionStore: ISessionStore;
  let mockRedis: Mocked<IRedisAdapter>;
  let mockDataSource: Mocked<DataSource>;
  let mockI18n: Mocked<I18nService>;
  let mockEventEmitter: Mocked<EventEmitter2>;
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

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn<Repository<User>['findOne']>(),
      save: vi.fn<Repository<User>['save']>().mockResolvedValue(sampleUser),
    } as unknown as Mocked<Repository<User>>;

    mockPasswordHasher = {
      hash: vi.fn().mockResolvedValue('new-hashed-password'),
      compare: vi.fn().mockResolvedValue(true),
    };

    mockSessionStore = {
      createSession: vi.fn(),
      getSession: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
      storeRefreshToken: vi.fn(),
      getUserIdByRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
      blacklistToken: vi.fn(),
      isTokenBlacklisted: vi.fn(),
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<IRedisAdapter>;

    mockDataSource = {
      transaction: vi
        .fn<
          (
            runInTransaction: (em: EntityManager) => Promise<unknown>,
          ) => Promise<unknown>
        >()
        .mockImplementation(async (runInTransaction) =>
          runInTransaction({
            getRepository: () => mockUserRepo,
          } as unknown as EntityManager),
        ),
    } as unknown as Mocked<DataSource>;

    mockI18n = {
      t: vi.fn().mockImplementation((key: string) => key),
    } as unknown as Mocked<I18nService>;

    mockEventEmitter = {
      emit: vi.fn(),
    } as unknown as Mocked<EventEmitter2>;

    mockLogger = new StructuredLogger();
    vi.spyOn(mockLogger, 'log').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'error').mockImplementation(() => undefined);

    command = new ResetPasswordCommand(
      mockPasswordHasher,
      mockSessionStore,
      mockRedis,
      mockDataSource,
      mockI18n,
      mockEventEmitter,
      mockLogger,
    );
  });

  describe('execute', () => {
    it('throws BadRequestException for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        command.execute({ token: '123456', passwordNew: 'newpass' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `${RESET_TOKEN_KEY_PREFIX}123456`,
      );
    });

    it('updates password and revokes sessions on valid token', async () => {
      mockRedis.get.mockResolvedValue({ userId: 'user-1' });
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      await command.execute({ token: '123456', passwordNew: 'newpass' });

      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('newpass');
      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'new-hashed-password',
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `${RESET_TOKEN_KEY_PREFIX}123456`,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        `${RESET_USER_KEY_PREFIX}user-1`,
      );
      expect(mockSessionStore.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-1',
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.reset_completed',
        expect.any(PasswordResetCompletedEvent),
      );
    });

    it('throws BadRequestException when user record is missing during reset', async () => {
      mockRedis.get.mockResolvedValue({ userId: 'ghost-user' });
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        command.execute({ token: '123456', passwordNew: 'newpass' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses transaction for password update', async () => {
      mockRedis.get.mockResolvedValue({ userId: 'user-1' });
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      await command.execute({ token: '123456', passwordNew: 'newpass' });

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });
});
