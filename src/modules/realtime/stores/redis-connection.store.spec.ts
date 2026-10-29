import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { RedisService } from '@bts-soft/cache';
import { RedisConnectionStore } from './redis-connection.store.js';
import { HEARTBEAT, RT_REDIS_KEYS } from '../constants/realtime.constants.js';

describe('RedisConnectionStore', () => {
  const redis = {
    hSet: vi.fn(),
    hGet: vi.fn(),
    sAdd: vi.fn(),
    sRem: vi.fn(),
    sMembers: vi.fn(),
    sIsMember: vi.fn(),
    sCard: vi.fn(),
    zAdd: vi.fn(),
    zRem: vi.fn(),
    zScore: vi.fn(),
    zRangeByScore: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  };
  let store: RedisConnectionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    redis.hSet.mockResolvedValue(1);
    redis.hGet.mockResolvedValue(null);
    redis.sAdd.mockResolvedValue(1);
    redis.sRem.mockResolvedValue(1);
    redis.sMembers.mockResolvedValue([]);
    redis.sIsMember.mockResolvedValue(false);
    redis.sCard.mockResolvedValue(0);
    redis.zAdd.mockResolvedValue(1);
    redis.zRem.mockResolvedValue(1);
    redis.zScore.mockResolvedValue(null);
    redis.zRangeByScore.mockResolvedValue([]);
    redis.expire.mockResolvedValue(true);
    redis.del.mockResolvedValue(1);
    store = new RedisConnectionStore(redis as unknown as RedisService);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('adds a socket to owner HASH, user and global SETs, and heartbeat ZSET', async () => {
    await store.addSocket('u1', 's1');
    expect(redis.hSet).toHaveBeenCalledWith(RT_REDIS_KEYS.socketUser('s1'), 'userId', 'u1');
    expect(redis.hSet).toHaveBeenCalledWith(RT_REDIS_KEYS.socketUser('s1'), 'connectedAt', expect.any(String));
    expect(redis.sAdd).toHaveBeenCalledWith(RT_REDIS_KEYS.userSockets('u1'), 's1');
    expect(redis.sAdd).toHaveBeenCalledWith(RT_REDIS_KEYS.ONLINE_USERS, 'u1');
    expect(redis.zAdd).toHaveBeenCalledWith(HEARTBEAT.NAME, expect.any(Number), 's1');
    expect(redis.expire).toHaveBeenCalledWith(RT_REDIS_KEYS.socketUser('s1'), HEARTBEAT.REDIS_TTL_SECONDS);
    expect(redis.expire).toHaveBeenCalledWith(RT_REDIS_KEYS.userSockets('u1'), HEARTBEAT.REDIS_TTL_SECONDS);
  });

  it('removes a socket and clears online presence only when it was the last connection', async () => {
    redis.hGet.mockResolvedValue('u1');
    redis.sCard.mockResolvedValue(0);
    await expect(store.removeSocket('s1')).resolves.toBe('u1');
    expect(redis.del).toHaveBeenCalledWith(RT_REDIS_KEYS.socketUser('s1'));
    expect(redis.zRem).toHaveBeenCalledWith(HEARTBEAT.NAME, 's1');
    expect(redis.sRem).toHaveBeenCalledWith(RT_REDIS_KEYS.userSockets('u1'), 's1');
    expect(redis.sRem).toHaveBeenCalledWith(RT_REDIS_KEYS.ONLINE_USERS, 'u1');
    expect(redis.del).toHaveBeenCalledWith(RT_REDIS_KEYS.userSockets('u1'));
  });

  it('retains global online presence if another socket remains', async () => {
    redis.hGet.mockResolvedValue('u1');
    redis.sCard.mockResolvedValue(1);
    await store.removeSocket('s1');
    expect(redis.sRem).not.toHaveBeenCalledWith(RT_REDIS_KEYS.ONLINE_USERS, 'u1');
  });

  it('cleans socket and heartbeat records even when the owner is unknown', async () => {
    await expect(store.removeSocket('missing')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith(RT_REDIS_KEYS.socketUser('missing'));
    expect(redis.zRem).toHaveBeenCalledWith(HEARTBEAT.NAME, 'missing');
  });

  it('delegates membership, socket listing, counts, and reverse lookup to Redis structures', async () => {
    redis.sMembers.mockResolvedValue(['s1', 's2']);
    redis.sIsMember.mockResolvedValue(true);
    redis.sCard.mockResolvedValue(3);
    redis.hGet.mockResolvedValue('u1');
    await expect(store.getUserSockets('u1')).resolves.toEqual(['s1', 's2']);
    await expect(store.isUserOnline('u1')).resolves.toBe(true);
    await expect(store.getAllConnectedUsersCount()).resolves.toBe(3);
    await expect(store.getUserIdBySocketId('s1')).resolves.toBe('u1');
    expect(redis.sMembers).toHaveBeenCalledWith(RT_REDIS_KEYS.userSockets('u1'));
    expect(redis.sIsMember).toHaveBeenCalledWith(RT_REDIS_KEYS.ONLINE_USERS, 'u1');
    expect(redis.sCard).toHaveBeenCalledWith(RT_REDIS_KEYS.ONLINE_USERS);
  });

  it('updates and queries heartbeat scores', async () => {
    await store.touchHeartbeat('s1');
    expect(redis.zAdd).toHaveBeenCalledWith(HEARTBEAT.NAME, expect.any(Number), 's1');
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    await store.findInactiveSockets(4_000);
    expect(redis.zRangeByScore).toHaveBeenCalledWith(HEARTBEAT.NAME, 0, 6_000);
  });

  it('returns the latest heartbeat across a user’s sockets', async () => {
    redis.sMembers.mockResolvedValue(['s1', 's2']);
    redis.zScore.mockImplementation((_key: string, member: string) =>
      Promise.resolve(member === 's1' ? 100 : 300),
    );
    await expect(store.getUserLastSeen('u1')).resolves.toBe(300);
  });

  it('returns null when a socket has no owner or heartbeat', async () => {
    redis.hGet.mockResolvedValue('   ');
    redis.sMembers.mockResolvedValue(['s1']);
    redis.zScore.mockResolvedValue(null);
    await expect(store.getUserIdBySocketId('s1')).resolves.toBeNull();
    await expect(store.getUserLastSeen('u1')).resolves.toBeNull();
  });

  it('fails soft and logs on Redis errors', async () => {
    redis.sMembers.mockRejectedValue(new Error('redis down'));
    redis.hGet.mockRejectedValue(new Error('redis down'));
    redis.sIsMember.mockRejectedValue(new Error('redis down'));
    redis.sCard.mockRejectedValue(new Error('redis down'));
    await expect(store.getUserSockets('u1')).resolves.toEqual([]);
    await expect(store.getUserIdBySocketId('s1')).resolves.toBeNull();
    await expect(store.isUserOnline('u1')).resolves.toBe(false);
    await expect(store.getAllConnectedUsersCount()).resolves.toBe(0);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('does not throw when socket registration or heartbeat writes fail', async () => {
    redis.hSet.mockRejectedValueOnce(new Error('redis down'));
    redis.zAdd.mockRejectedValueOnce(new Error('redis down'));
    await expect(store.addSocket('u1', 's1')).resolves.toBeUndefined();
    await expect(store.touchHeartbeat('s1')).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});
