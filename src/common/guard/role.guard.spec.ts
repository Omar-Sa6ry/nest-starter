import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RoleGuard } from './role.guard.js';
import type {
  ITokenProvider,
  ISessionStore,
} from '../interfaces/ISecurity.interface.js';
import { Role, Permission } from '../constant/enum.constant.js';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let mockTokenProvider: ITokenProvider;
  let mockSessionStore: ISessionStore;
  let mockReflector: Reflector;
  let mockI18n: { t: ReturnType<typeof vi.fn> };

  const validPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    permissions: [],
    sessionId: 'session-1',
  };

  function buildContext(authHeader?: string, type = 'graphql') {
    const req = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => function handler() {},
      getClass: () => function cls() {},
    } as never;
  }

  function buildGqlContext(authHeader?: string) {
    const req = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      getType: () => 'graphql',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => function handler() {},
      getClass: () => function cls() {},
    } as never;
  }

  beforeEach(() => {
    mockTokenProvider = {
      generateTokens: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
      getJti: vi.fn(),
    };
    mockSessionStore = {
      createSession: vi.fn(),
      getSession: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      blacklistToken: vi.fn(),
      isTokenBlacklisted: vi.fn(),
      storeRefreshToken: vi.fn(),
      getUserIdByRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
    };
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue([]),
    } as unknown as Reflector;
    mockI18n = { t: vi.fn().mockImplementation((key: string) => key) };

    guard = new RoleGuard(
      mockI18n as never,
      mockTokenProvider,
      mockSessionStore,
      mockReflector,
    );

    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { headers: { authorization: 'Bearer valid-token' } },
      }),
    } as never);
  });

  it('throws UnauthorizedException when no token is provided', async () => {
    const context = buildGqlContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token is blacklisted', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue('jti-1');
    vi.mocked(mockSessionStore.isTokenBlacklisted).mockResolvedValue(true);

    const context = buildGqlContext('Bearer blacklisted-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token verification fails', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue(null);
    vi.mocked(mockTokenProvider.verifyAccessToken).mockResolvedValue(null);

    const context = buildGqlContext('Bearer bad-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when user lacks required permissions', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue(null);
    vi.mocked(mockTokenProvider.verifyAccessToken).mockResolvedValue(
      validPayload,
    );
    vi.mocked(mockReflector.getAllAndOverride).mockImplementation(
      (key: unknown) => {
        if (key === 'permissions') return [Permission.DELETE_USER];
        return [];
      },
    );

    const context = buildGqlContext('Bearer valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns true and sets request.user when authorized', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue(null);
    vi.mocked(mockTokenProvider.verifyAccessToken).mockResolvedValue(
      validPayload,
    );
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue([]);

    const context = buildGqlContext('Bearer valid-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('works with http context', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue(null);
    vi.mocked(mockTokenProvider.verifyAccessToken).mockResolvedValue(
      validPayload,
    );
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue([]);
    vi.spyOn(GqlExecutionContext, 'create').mockRestore();

    const context = buildContext('Bearer valid-token', 'http');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when authorization header is not Bearer', async () => {
    const context = buildGqlContext('Basic abc123');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when request has no headers', async () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => undefined,
        getResponse: () => ({}),
      }),
      getHandler: () => function handler() {},
      getClass: () => function cls() {},
    } as never;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when payload has no userId', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue(null);
    vi.mocked(mockTokenProvider.verifyAccessToken).mockResolvedValue({
      ...validPayload,
      userId: undefined,
    } as never);
    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { headers: { authorization: 'Bearer valid-token' } },
      }),
    } as never);

    const context = buildGqlContext('Bearer valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when user lacks required role', async () => {
    vi.mocked(mockTokenProvider.getJti).mockResolvedValue(null);
    vi.mocked(mockTokenProvider.verifyAccessToken).mockResolvedValue(
      validPayload,
    );
    vi.mocked(mockReflector.getAllAndOverride).mockImplementation(
      (key: unknown) => {
        if (key === 'roles') return [Role.ADMIN];
        return [];
      },
    );
    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { headers: { authorization: 'Bearer valid-token' } },
      }),
    } as never);

    const context = buildGqlContext('Bearer valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
