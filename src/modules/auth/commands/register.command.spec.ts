import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';
import { User } from '../../user/entity/user.entity.js';
import { Role } from '../../../common/constant/enum.constant.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { RegisterCommand } from './register.command.js';
import { UserFactory } from '../factory/user.factory.js';
import type {
  IPasswordHasher,
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { I18nService } from 'nestjs-i18n';
import { UserRegisteredEvent } from '../events/domain.events.js';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

describe('RegisterCommand', () => {
  let command: RegisterCommand;
  let mockUserRepo: Mocked<Repository<User>>;
  let mockUserFactory: Mocked<UserFactory>;
  let mockPasswordHasher: IPasswordHasher;
  let mockTokenProvider: ITokenProvider;
  let mockSessionStore: ISessionStore;
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

  const sampleTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 86400,
  };

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn<Repository<User>['findOne']>(),
      count: vi.fn<Repository<User>['count']>(),
      save: vi.fn<Repository<User>['save']>(),
    } as unknown as Mocked<Repository<User>>;

    mockUserFactory = {
      createUser: vi.fn<UserFactory['createUser']>().mockReturnValue(sampleUser),
    } as unknown as Mocked<UserFactory>;

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
      isTokenBlacklisted: vi.fn(),
    };

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

    command = new RegisterCommand(
      mockUserFactory,
      mockPasswordHasher,
      mockTokenProvider,
      mockSessionStore,
      mockDataSource,
      mockI18n,
      mockEventEmitter,
      mockLogger,
    );
  });

  describe('execute', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '01234567890',
      imageUrl: 'https://example.com/img.png',
    };

    it('throws BadRequestException when email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(sampleUser);

      await expect(command.execute(validInput)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('throws BadRequestException when phone already exists', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);
      mockUserRepo.findOne.mockResolvedValueOnce({
        ...sampleUser,
        phoneNumber: '01234567890',
      });

      await expect(command.execute(validInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('assigns ADMIN role to the first registered user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(0);
      mockUserRepo.save.mockResolvedValue({ ...sampleUser, role: Role.ADMIN });

      const result = await command.execute({
        email: 'first@example.com',
        password: 'password123',
        firstName: 'First',
        lastName: 'Admin',
      });

      expect(mockUserFactory.createUser).toHaveBeenCalledWith(
        'first@example.com',
        'hashed-password',
        'First',
        'Admin',
        Role.ADMIN,
        undefined,
        undefined,
      );
      expect(result.user.role).toBe(Role.ADMIN);
    });

    it('creates user, session, stores refresh token, and emits event on success', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(5);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      const result = await command.execute(validInput);

      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('password123');
      expect(mockUserFactory.createUser).toHaveBeenCalledWith(
        'test@example.com',
        'hashed-password',
        'Test',
        'User',
        Role.USER,
        '01234567890',
        'https://example.com/img.png',
      );
      expect(mockUserRepo.save).toHaveBeenCalled();
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
        'user.registered',
        expect.any(UserRegisteredEvent),
      );
      expect(result.user.id).toBe('user-1');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('normalizes email to lowercase and trims', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(1);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      await command.execute({
        ...validInput,
        email: '  TEST@EXAMPLE.COM  ',
      });

      expect(mockUserFactory.createUser).toHaveBeenCalledWith(
        'test@example.com',
        'hashed-password',
        'Test',
        'User',
        Role.USER,
        '01234567890',
        'https://example.com/img.png',
      );
    });

    it('handles optional phoneNumber and imageUrl', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(1);
      mockUserRepo.save.mockResolvedValue(sampleUser);

      const result = await command.execute({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.user.role).toBe(Role.USER);
      expect(mockUserFactory.createUser).toHaveBeenCalledWith(
        'test@example.com',
        'hashed-password',
        'Test',
        'User',
        Role.USER,
        undefined,
        undefined,
      );
    });
  });
});
