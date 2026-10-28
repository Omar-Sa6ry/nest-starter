import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { LogoutCommand } from './logout.command.js';
import type {
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { UserLoggedOutEvent } from '../events/domain.events.js';

describe('LogoutCommand', () => {
  let command: LogoutCommand;
  let mockTokenProvider: ITokenProvider;
  let mockSessionStore: ISessionStore;
  let mockEventEmitter: Mocked<EventEmitter2>;
  let mockLogger: StructuredLogger;

  beforeEach(() => {
    mockTokenProvider = {
      generateTokens: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
      getJti: vi.fn().mockResolvedValue('jti-1'),
    };

    mockSessionStore = {
      createSession: vi.fn(),
      getSession: vi.fn(),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      revokeAllUserSessions: vi.fn(),
      storeRefreshToken: vi.fn(),
      getUserIdByRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
      blacklistToken: vi.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: vi.fn(),
    };

    mockEventEmitter = {
      emit: vi.fn(),
    } as unknown as Mocked<EventEmitter2>;

    mockLogger = new StructuredLogger();
    vi.spyOn(mockLogger, 'log').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(mockLogger, 'error').mockImplementation(() => undefined);

    command = new LogoutCommand(
      mockTokenProvider,
      mockSessionStore,
      mockEventEmitter,
      mockLogger,
    );
  });

  describe('execute', () => {
    it('revokes session and blacklists token when access token provided', async () => {
      await command.execute({
        userId: 'user-1',
        sessionId: 'session-1',
        accessToken: 'access-token',
      });

      expect(mockSessionStore.revokeSession).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
      expect(mockTokenProvider.getJti).toHaveBeenCalledWith('access-token');
      expect(mockSessionStore.blacklistToken).toHaveBeenCalledWith(
        'jti-1',
        3600 * 24,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_out',
        expect.any(UserLoggedOutEvent),
      );
    });

    it('skips blacklist when no access token provided', async () => {
      await command.execute({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(mockSessionStore.revokeSession).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
      expect(mockTokenProvider.getJti).not.toHaveBeenCalled();
      expect(mockSessionStore.blacklistToken).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_out',
        expect.any(UserLoggedOutEvent),
      );
    });

    it('emits correct event with userId and sessionId', async () => {
      await command.execute({
        userId: 'user-123',
        sessionId: 'session-456',
        accessToken: 'access-token',
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_out',
        expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-456',
        }),
      );
    });

    it('logs logout action', async () => {
      await command.execute({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(mockLogger.log).toHaveBeenCalledWith(
        'User logged out: user-1',
        'LogoutCommand',
      );
    });
  });
});
