import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisSessionRepository } from './redis-session.repository.js';

describe('RedisSessionRepository', () => {
  let repo: RedisSessionRepository;
  let mockRedis: Record<string, ReturnType<typeof vi.fn>>;

  const sessionData = {
    userId: 'user-1',
    email: 'test@example.com',
    role: 'user',
    sessionId: 'session-1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockRedis = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      delByPattern: vi.fn(),
    };
    repo = new RedisSessionRepository(mockRedis as never);
  });

  it('creates a session', async () => {
    await repo.createSession('user-1', 'session-1', sessionData, 3600);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'user:session:user-1:session-1',
      sessionData,
      3600,
    );
  });

  it('gets a session', async () => {
    mockRedis.get.mockResolvedValue(sessionData);

    const result = await repo.getSession('user-1', 'session-1');

    expect(result).toEqual(sessionData);
    expect(mockRedis.get).toHaveBeenCalledWith(
      'user:session:user-1:session-1',
    );
  });

  it('returns null when session missing', async () => {
    mockRedis.get.mockResolvedValue(null);

    expect(await repo.getSession('user-1', 'missing')).toBeNull();
  });

  it('revokes a session', async () => {
    await repo.revokeSession('user-1', 'session-1');

    expect(mockRedis.del).toHaveBeenCalledWith(
      'user:session:user-1:session-1',
    );
  });

  it('revokes all user sessions by pattern', async () => {
    await repo.revokeAllUserSessions('user-1');

    expect(mockRedis.delByPattern).toHaveBeenCalledWith(
      'user:session:user-1:*',
    );
  });

  it('blacklists a token', async () => {
    await repo.blacklistToken('jti-1', 86400);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'token:blacklist:jti-1',
      { blacklisted: true },
      86400,
    );
  });

  it('detects a blacklisted token', async () => {
    mockRedis.get.mockResolvedValue({ blacklisted: true });

    expect(await repo.isTokenBlacklisted('jti-1')).toBe(true);
  });

  it('treats missing blacklist entry as not blacklisted', async () => {
    mockRedis.get.mockResolvedValue(null);

    expect(await repo.isTokenBlacklisted('jti-1')).toBe(false);
  });

  it('stores a refresh token', async () => {
    await repo.storeRefreshToken('hash-1', 'user-1', 604800);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'user:refresh:hash-1',
      { userId: 'user-1' },
      604800,
    );
  });

  it('resolves user id by refresh token', async () => {
    mockRedis.get.mockResolvedValue({ userId: 'user-1' });

    expect(await repo.getUserIdByRefreshToken('hash-1')).toBe('user-1');
  });

  it('returns null for unknown refresh token', async () => {
    mockRedis.get.mockResolvedValue(null);

    expect(await repo.getUserIdByRefreshToken('hash-1')).toBeNull();
  });

  it('returns null when refresh payload has no userId', async () => {
    mockRedis.get.mockResolvedValue({});

    expect(await repo.getUserIdByRefreshToken('hash-1')).toBeNull();
  });

  it('revokes a refresh token', async () => {
    await repo.revokeRefreshToken('hash-1');

    expect(mockRedis.del).toHaveBeenCalledWith('user:refresh:hash-1');
  });
});
