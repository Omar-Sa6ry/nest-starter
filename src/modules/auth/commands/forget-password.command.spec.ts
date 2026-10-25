import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Repository } from 'typeorm';
import { ForgetPasswordCommand } from './forget-password.command.js';
import type {
  IRedisAdapter,
  INotificationAdapter,
} from '../interfaces/IAuth.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { I18nService } from 'nestjs-i18n';
import { PasswordResetRequestedEvent } from '../events/domain.events.js';

const RESET_TOKEN_TTL_SECONDS = 15 * 60;
const RESET_TOKEN_KEY_PREFIX = 'password_reset:token:';
const RESET_USER_KEY_PREFIX = 'password_reset:user:';

describe('ForgetPasswordCommand', () => {
  let command: ForgetPasswordCommand;
  let mockUserRepo: Repository<any>;
  let mockRedis: IRedisAdapter;
  let mockNotification: INotificationAdapter;
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
    role: 'USER',
    isActive: true,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn(),
    } as any;

    mockRedis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };

    mockNotification = {
      sendEmail: vi.fn().mockResolvedValue(undefined),
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

    command = new ForgetPasswordCommand(
      mockUserRepo,
      mockRedis,
      mockNotification,
      mockI18n,
      mockEventEmitter,
      mockLogger,
    );
  });

  describe('execute', () => {
    it('stores reset token in Redis when user exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockRedis.get.mockResolvedValue(null);

      await command.execute({ email: 'test@example.com' });

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${RESET_TOKEN_KEY_PREFIX}\\d{6}$`)),
        { userId: 'user-1' },
        RESET_TOKEN_TTL_SECONDS,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `${RESET_USER_KEY_PREFIX}user-1`,
        expect.stringMatching(/^\d{6}$/),
        RESET_TOKEN_TTL_SECONDS,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.reset_requested',
        expect.any(PasswordResetRequestedEvent),
      );
    });

    it('removes previous reset token when one exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockRedis.get.mockResolvedValue('999999');

      await command.execute({ email: 'test@example.com' });

      expect(mockRedis.del).toHaveBeenCalledWith(
        `${RESET_TOKEN_KEY_PREFIX}999999`,
      );
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
    });

    it('sends reset password email via notification service', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockRedis.get.mockResolvedValue(null);

      await command.execute({ email: 'test@example.com' });

      expect(mockNotification.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'user.PASSWORD_RESET_SUBJECT',
        'user.PASSWORD_RESET_BODY',
        expect.objectContaining({
          name: 'Test',
        }),
      );
    });

    it('handles email send failure gracefully', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockRedis.get.mockResolvedValue(null);
      mockNotification.sendEmail.mockRejectedValue(
        new Error('Email service down'),
      );

      await expect(
        command.execute({ email: 'test@example.com' }),
      ).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send reset password email'),
        expect.any(String),
        'ForgetPasswordCommand',
      );
    });

    it('silently returns when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        command.execute({ email: 'nonexistent@example.com' }),
      ).resolves.toBeUndefined();

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockNotification.sendEmail).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase and trims', async () => {
      mockUserRepo.findOne.mockResolvedValue(sampleUser);
      mockRedis.get.mockResolvedValue(null);

      await command.execute({ email: '  TEST@EXAMPLE.COM  ' });

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });
});
