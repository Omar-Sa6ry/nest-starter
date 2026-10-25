import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JwtTokenProvider } from './jwt-token.provider.js';
import { Role } from '../constant/enum.constant.js';

describe('JwtTokenProvider', () => {
  let provider: JwtTokenProvider;
  let mockJwt: Record<string, ReturnType<typeof vi.fn>>;
  let mockConfig: Record<string, ReturnType<typeof vi.fn>>;

  const payload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    permissions: ['read'],
    sessionId: 'session-1',
  };

  beforeEach(() => {
    mockJwt = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(),
    };
    mockConfig = {
      get: vi.fn().mockReturnValue('test-secret'),
    };

    provider = new JwtTokenProvider(
      mockJwt as never,
      mockConfig as never,
    );
  });

  it('throws when JWT_SECRET is missing', async () => {
    mockConfig.get.mockReturnValue(undefined);

    await expect(provider.generateTokens(payload)).rejects.toThrow(
      'JWT_SECRET environment variable is required',
    );
  });

  it('generates access and refresh tokens', async () => {
    mockJwt.signAsync
      .mockResolvedValueOnce('access-jwt')
      .mockResolvedValueOnce('refresh-jwt');

    const result = await provider.generateTokens(payload);

    expect(result.accessToken).toBe('access-jwt');
    expect(result.refreshToken).toBe('refresh-jwt');
    expect(result.expiresIn).toBe(86400);
    expect(mockJwt.signAsync).toHaveBeenCalledTimes(2);
    expect(mockJwt.signAsync.mock.calls[1][1]).toMatchObject({
      expiresIn: 604800,
    });
  });

  it('verifies access tokens', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      role: Role.USER,
      permissions: ['read'],
      sessionId: 'session-1',
    });

    const result = await provider.verifyAccessToken('token');

    expect(result).toEqual({
      userId: 'user-1',
      email: 'test@example.com',
      role: Role.USER,
      permissions: ['read'],
      sessionId: 'session-1',
    });
  });

  it('falls back to sub claim for userId', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      sub: 'user-sub',
      email: 'a@b.c',
      role: Role.USER,
      sessionId: 's1',
    });

    const result = await provider.verifyAccessToken('token');

    expect(result?.userId).toBe('user-sub');
    expect(result?.permissions).toEqual([]);
  });

  it('returns null when access token verification fails', async () => {
    mockJwt.verifyAsync.mockRejectedValue(new Error('bad'));

    expect(await provider.verifyAccessToken('bad')).toBeNull();
  });

  it('verifies refresh tokens', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      type: 'refresh',
      userId: 'user-1',
      sessionId: 'session-1',
    });

    const result = await provider.verifyRefreshToken('refresh');

    expect(result).toEqual({
      userId: 'user-1',
      email: '',
      role: '',
      permissions: [],
      sessionId: 'session-1',
    });
  });

  it('rejects access tokens used as refresh tokens', async () => {
    mockJwt.verifyAsync.mockResolvedValue({ type: 'access' });

    expect(await provider.verifyRefreshToken('access-token')).toBeNull();
  });

  it('returns null when refresh verification fails', async () => {
    mockJwt.verifyAsync.mockRejectedValue(new Error('expired'));

    expect(await provider.verifyRefreshToken('expired')).toBeNull();
  });

  it('extracts jti from a valid token', async () => {
    mockJwt.verifyAsync.mockResolvedValue({ jti: 'jti-123' });

    expect(await provider.getJti('token')).toBe('jti-123');
  });

  it('returns null jti when token has none', async () => {
    mockJwt.verifyAsync.mockResolvedValue({});

    expect(await provider.getJti('token')).toBeNull();
  });

  it('returns null jti when verification fails', async () => {
    mockJwt.verifyAsync.mockRejectedValue(new Error('bad'));

    expect(await provider.getJti('bad')).toBeNull();
  });
});
