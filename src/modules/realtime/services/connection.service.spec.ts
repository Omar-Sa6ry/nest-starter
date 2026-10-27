import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { MockInstance } from 'vitest';
import { ConnectionService } from './connection.service.js';
import type { IConnectionStore } from '../stores/interfaces/IConnectionStore.interface.js';

describe('ConnectionService', () => {
  let store: IConnectionStore;
  let service: ConnectionService;
  let logSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    store = {
      addSocket: vi.fn().mockResolvedValue(undefined),
      removeSocket: vi.fn().mockResolvedValue(null),
      getUserSockets: vi.fn().mockResolvedValue([]),
      getUserIdBySocketId: vi.fn().mockResolvedValue(null),
      isUserOnline: vi.fn().mockResolvedValue(false),
      touchHeartbeat: vi.fn().mockResolvedValue(undefined),
      findInactiveSockets: vi.fn().mockResolvedValue([]),
      getAllConnectedUsersCount: vi.fn().mockResolvedValue(0),
      getUserLastSeen: vi.fn().mockResolvedValue(null),
    };
    service = new ConnectionService(store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('onConnect registers the socket in the store', async () => {
    await service.onConnect('u1', 's1');

    expect(store.addSocket).toHaveBeenCalledWith('u1', 's1');
    expect(logSpy).toHaveBeenCalled();
  });

  it('onDisconnect returns the owning user id', async () => {
    vi.mocked(store.removeSocket).mockResolvedValue('u1');

    await expect(service.onDisconnect('s1')).resolves.toBe('u1');
    expect(store.removeSocket).toHaveBeenCalledWith('s1');
    expect(logSpy).toHaveBeenCalled();
  });

  it('onDisconnect returns null for an unknown socket', async () => {
    await expect(service.onDisconnect('s1')).resolves.toBeNull();
    expect(logSpy).toHaveBeenCalled();
  });

  it('getUserSockets delegates to the store', async () => {
    vi.mocked(store.getUserSockets).mockResolvedValue(['s1', 's2']);

    await expect(service.getUserSockets('u1')).resolves.toEqual(['s1', 's2']);
    expect(store.getUserSockets).toHaveBeenCalledWith('u1');
  });

  it('isUserOnline delegates to the store', async () => {
    vi.mocked(store.isUserOnline).mockResolvedValue(true);

    await expect(service.isUserOnline('u1')).resolves.toBe(true);
    expect(store.isUserOnline).toHaveBeenCalledWith('u1');
  });

  it('getUserPresence reports an online user with its freshest heartbeat', async () => {
    vi.mocked(store.getUserSockets).mockResolvedValue(['s1', 's2']);
    vi.mocked(store.getUserLastSeen).mockResolvedValue(1_700_000_000_000);

    const presence = await service.getUserPresence('u1');

    expect(presence).toEqual({
      userId: 'u1',
      isOnline: true,
      connectionsCount: 2,
      lastSeenAt: new Date(1_700_000_000_000),
    });
    expect(presence.lastSeenAt).toBeInstanceOf(Date);
  });

  it('getUserPresence reports an offline user without a last seen date', async () => {
    const presence = await service.getUserPresence('u2');

    expect(presence).toEqual({
      userId: 'u2',
      isOnline: false,
      connectionsCount: 0,
      lastSeenAt: null,
    });
  });

  it('getUserPresence keeps lastSeenAt null for an online user without heartbeat', async () => {
    vi.mocked(store.getUserSockets).mockResolvedValue(['s1']);

    const presence = await service.getUserPresence('u1');

    expect(presence.isOnline).toBe(true);
    expect(presence.connectionsCount).toBe(1);
    expect(presence.lastSeenAt).toBeNull();
  });

  it('recordHeartbeat delegates to the store', async () => {
    await service.recordHeartbeat('s1');

    expect(store.touchHeartbeat).toHaveBeenCalledWith('s1');
  });

  it('getConnectedUsersCount delegates to the store', async () => {
    vi.mocked(store.getAllConnectedUsersCount).mockResolvedValue(5);

    await expect(service.getConnectedUsersCount()).resolves.toBe(5);
  });
});
