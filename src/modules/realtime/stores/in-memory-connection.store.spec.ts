import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryConnectionStore } from './in-memory-connection.store.js';

interface StoreInternals {
  userToSockets: Map<string, Set<string>>;
  socketHeartbeats: Map<string, number>;
}

describe('InMemoryConnectionStore', () => {
  let store: InMemoryConnectionStore;

  beforeEach(() => {
    store = new InMemoryConnectionStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers sockets and resolves ownership both ways', async () => {
    await store.addSocket('u1', 's1');
    await store.addSocket('u1', 's2');

    expect(await store.getUserSockets('u1')).toEqual(['s1', 's2']);
    expect(await store.getUserIdBySocketId('s1')).toBe('u1');
    expect(await store.getUserIdBySocketId('unknown')).toBeNull();
    expect(await store.isUserOnline('u1')).toBe(true);
    expect(await store.isUserOnline('u2')).toBe(false);
    expect(await store.getAllConnectedUsersCount()).toBe(1);
  });

  it('returns an empty list for an unknown user', async () => {
    expect(await store.getUserSockets('ghost')).toEqual([]);
  });

  it('returns null when removing an unknown socket', async () => {
    expect(await store.removeSocket('ghost')).toBeNull();
  });

  it('keeps the user entry alive while another socket remains', async () => {
    await store.addSocket('u1', 's1');
    await store.addSocket('u1', 's2');

    expect(await store.removeSocket('s1')).toBe('u1');
    expect(await store.getUserSockets('u1')).toEqual(['s2']);
    expect(await store.isUserOnline('u1')).toBe(true);
  });

  it('drops the user entry when the last socket is removed', async () => {
    await store.addSocket('u1', 's1');
    await store.removeSocket('s1');

    expect(await store.getUserSockets('u1')).toEqual([]);
    expect(await store.isUserOnline('u1')).toBe(false);
    expect(await store.getAllConnectedUsersCount()).toBe(0);
  });

  it('tolerates a missing user entry while removing a socket', async () => {
    await store.addSocket('u1', 's1');
    const internals = store as unknown as StoreInternals;
    internals.userToSockets.delete('u1');

    await expect(store.removeSocket('s1')).resolves.toBe('u1');
  });

  it('reports offline when the user entry holds an empty socket set', async () => {
    await store.addSocket('u1', 's1');
    const internals = store as unknown as StoreInternals;
    internals.userToSockets.set('u1', new Set());

    expect(await store.isUserOnline('u1')).toBe(false);
  });

  it('touchHeartbeat refreshes the timestamp of a known socket', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await store.addSocket('u1', 's1');

    now.mockReturnValue(5_000);
    await store.touchHeartbeat('s1');

    expect(await store.getUserLastSeen('u1')).toBe(5_000);
  });

  it('touchHeartbeat is a no-op for an unknown socket', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await store.addSocket('u1', 's1');

    await store.touchHeartbeat('ghost');
    now.mockReturnValue(10_000);

    // The ghost socket left no heartbeat record behind.
    expect(await store.findInactiveSockets(500)).toEqual(['s1']);
  });

  it('findInactiveSockets lists only sockets past the threshold', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await store.addSocket('u1', 's1');
    await store.addSocket('u2', 's2');

    now.mockReturnValue(1_500);
    // Exactly at the threshold is not stale yet (strictly greater).
    expect(await store.findInactiveSockets(500)).toEqual([]);

    now.mockReturnValue(1_501);
    expect(await store.findInactiveSockets(500)).toEqual(['s1', 's2']);
  });

  it('findInactiveSockets returns an empty list for an empty registry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);

    expect(await store.findInactiveSockets(500)).toEqual([]);
  });

  it('getUserLastSeen returns null for an unknown user', async () => {
    expect(await store.getUserLastSeen('ghost')).toBeNull();
  });

  it('getUserLastSeen returns the freshest heartbeat across sockets', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await store.addSocket('u1', 's1');
    now.mockReturnValue(3_000);
    await store.addSocket('u1', 's2');
    now.mockReturnValue(5_000);
    await store.touchHeartbeat('s1');

    expect(await store.getUserLastSeen('u1')).toBe(5_000);
  });

  it('getUserLastSeen returns null when every heartbeat is zero', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    await store.addSocket('u1', 's1');

    expect(await store.getUserLastSeen('u1')).toBeNull();
  });

  it('getUserLastSeen returns null when a socket has no heartbeat record', async () => {
    await store.addSocket('u1', 's1');
    const internals = store as unknown as StoreInternals;
    internals.socketHeartbeats.delete('s1');

    expect(await store.getUserLastSeen('u1')).toBeNull();
  });
});
