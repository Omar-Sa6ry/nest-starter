import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { MockInstance } from 'vitest';
import { RealtimeService } from './realtime.service.js';
import type { RealtimeGateway } from '../gateway/realtime.gateway.js';
import { ConnectionService } from './connection.service.js';
import type { UserPresenceStatus } from '../types/realtime.types.js';

describe('RealtimeService', () => {
  let to: MockInstance;
  let socketEmit: MockInstance;
  let serverEmit: MockInstance;
  let gateway: RealtimeGateway;
  let connectionService: ConnectionService;
  let service: RealtimeService;
  let debugLog: MockInstance;

  beforeEach(() => {
    debugLog = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    socketEmit = vi.fn();
    to = vi.fn().mockReturnValue({ emit: socketEmit });
    serverEmit = vi.fn();
    gateway = {
      server: { to, emit: serverEmit },
    } as unknown as RealtimeGateway;
    connectionService = {
      isUserOnline: vi.fn().mockResolvedValue(false),
      getUserPresence: vi.fn(),
      getConnectedUsersCount: vi.fn().mockResolvedValue(0),
    } as unknown as ConnectionService;
    service = new RealtimeService(gateway, connectionService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('emitToUser', () => {
    it('returns false and touches nothing when the user is offline', async () => {
      await expect(service.emitToUser('u1', 'evt', { a: 1 })).resolves.toBe(false);
      expect(to).not.toHaveBeenCalled();
      expect(debugLog).toHaveBeenCalled();
    });

    it('emits the enveloped event to the personal user room when online', async () => {
      vi.mocked(connectionService.isUserOnline).mockResolvedValue(true);

      await expect(service.emitToUser('u1', 'order.created', { orderId: 7 })).resolves.toBe(true);
      expect(to).toHaveBeenCalledWith('user:u1');
      expect(socketEmit).toHaveBeenCalledWith('order.created', {
        success: true,
        statusCode: 200,
        message: '',
        event: 'order.created',
        data: { orderId: 7 },
        timestamp: expect.any(String),
      });
    });
  });

  describe('emitToUsers', () => {
    it('emits only to the users that are online', async () => {
      vi.mocked(connectionService.isUserOnline).mockImplementation((userId: string) =>
        Promise.resolve(userId === 'u1'),
      );

      await service.emitToUsers(['u1', 'u2'], 'evt', 'payload');

      expect(to).toHaveBeenCalledTimes(1);
      expect(to).toHaveBeenCalledWith('user:u1');
      expect(socketEmit).toHaveBeenCalledTimes(1);
    });

    it('resolves without emitting when no user is online', async () => {
      await service.emitToUsers(['u1', 'u2'], 'evt', 'payload');

      expect(to).not.toHaveBeenCalled();
    });
  });

  describe('emitToRoom', () => {
    it('emits the enveloped event to the given room', () => {
      service.emitToRoom('room:chat-1', 'room_message', { text: 'hi' });

      expect(to).toHaveBeenCalledWith('room:chat-1');
      expect(socketEmit).toHaveBeenCalledWith('room_message', {
        success: true,
        statusCode: 200,
        message: '',
        event: 'room_message',
        data: { text: 'hi' },
        timestamp: expect.any(String),
      });
    });
  });

  describe('broadcast', () => {
    it('emits the enveloped event globally', () => {
      service.broadcast('announcement', 'hello');

      expect(serverEmit).toHaveBeenCalledWith('announcement', {
        success: true,
        statusCode: 200,
        message: '',
        event: 'announcement',
        data: 'hello',
        timestamp: expect.any(String),
      });
      expect(to).not.toHaveBeenCalled();
    });
  });

  describe('presence and counts', () => {
    it('getUserPresence delegates to the connection service', async () => {
      const presence: UserPresenceStatus = {
        userId: 'u1',
        isOnline: true,
        connectionsCount: 2,
        lastSeenAt: new Date(1_700_000_000_000),
      };
      vi.mocked(connectionService.getUserPresence).mockResolvedValue(presence);

      await expect(service.getUserPresence('u1')).resolves.toBe(presence);
      expect(connectionService.getUserPresence).toHaveBeenCalledWith('u1');
    });

    it('getOnlineUsersCount delegates to the connection service', async () => {
      vi.mocked(connectionService.getConnectedUsersCount).mockResolvedValue(3);

      await expect(service.getOnlineUsersCount()).resolves.toBe(3);
    });
  });
});
