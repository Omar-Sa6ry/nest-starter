import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { TranslateOptions } from 'nestjs-i18n';
import { WsAuthGuard } from './ws-auth.guard.js';
import type { I18nTranslate } from '../../types/i18n.types.js';
import type { AuthenticatedSocket } from '../../types/realtime.types.js';
import { WS_DEFAULT_LANG } from '../../constants/realtime.constants.js';
import { WS_I18N } from '../../constants/realtime-i18n.constants.js';
import { Role, Permission } from '../../../../common/constant/enum.constant.js';
import type { ISessionStore } from '../../../../common/interfaces/ISecurity.interface.js';

describe('WsAuthGuard', () => {
  let translate: Mock<(key: string, options?: TranslateOptions) => string>;
  let reflector: Reflector;
  let sessionStore: ISessionStore;
  let guard: WsAuthGuard;

  function wsContext(client: unknown): ExecutionContext {
    return {
      getType: () => 'ws',
      switchToWs: () => ({
        getClient: () => client,
        getPattern: () => 'ping',
      }),
      getHandler: () => function handler() {},
      getClass: () => function cls() {},
    } as unknown as ExecutionContext;
  }

  const httpContext = {
    getType: () => 'http',
  } as unknown as ExecutionContext;

  beforeEach(() => {
    translate = vi.fn((key: string, _options?: TranslateOptions) => `tx:${key}`);
    const mockI18n = { t: translate } as unknown as I18nTranslate;
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([]),
    } as unknown as Reflector;
    sessionStore = {
      isTokenBlacklisted: vi.fn().mockResolvedValue(false),
      createSession: vi.fn(),
      getSession: vi.fn(),
      destroySession: vi.fn(),
      destroyAllUserSessions: vi.fn(),
      blacklistToken: vi.fn(),
      storeRefreshToken: vi.fn(),
      getRefreshTokenUserId: vi.fn(),
      revokeRefreshToken: vi.fn(),
      revokeAllUserRefreshTokens: vi.fn(),
    } as unknown as ISessionStore;

    guard = new WsAuthGuard(mockI18n, reflector, sessionStore);
  });

  it('allows non-ws contexts untouched', async () => {
    await expect(guard.canActivate(httpContext)).resolves.toBe(true);
  });

  it('allows a ws client whose handshake already authenticated', async () => {
    const client = {
      data: { user: { userId: 'user-1', role: Role.USER, permissions: [] } },
    } as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);
  });

  it('rejects a ws client without an authenticated user', async () => {
    const client = { data: {} } as unknown as AuthenticatedSocket;

    let thrown: unknown;
    try {
      await guard.canActivate(wsContext(client));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(WsException);
    expect((thrown as WsException).getError()).toEqual({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'tx:realtime.UNAUTHORIZED',
      statusCode: 401,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(translate).toHaveBeenCalledWith(WS_I18N.UNAUTHORIZED, {
      lang: WS_DEFAULT_LANG,
    });
  });

  it('rejects a ws client with a blacklisted sessionId', async () => {
    vi.mocked(sessionStore.isTokenBlacklisted).mockResolvedValue(true);
    const client = {
      data: { user: { userId: 'user-1', sessionId: 'blacklisted-session' } },
    } as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(client))).rejects.toThrow(WsException);
  });

  it('enforces required roles and permissions', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: any) => {
      if (key === 'roles') return [Role.ADMIN];
      return [];
    });

    const clientUser = {
      data: { user: { userId: 'user-1', role: Role.USER, permissions: [] } },
    } as unknown as AuthenticatedSocket;

    let thrown: unknown;
    try {
      await guard.canActivate(wsContext(clientUser));
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(WsException);
    expect((thrown as WsException).getError()).toEqual({
      success: false,
      code: 'FORBIDDEN',
      message: 'tx:realtime.INSUFFICIENT_PERMISSIONS',
      statusCode: 403,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('allows access when user has the required permission', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: any) => {
      if (key === 'permissions') return [Permission.VIEW_USER];
      return [];
    });

    const clientAdmin = {
      data: {
        user: {
          userId: 'admin-1',
          role: Role.ADMIN,
          permissions: [Permission.VIEW_USER],
        },
      },
    } as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(clientAdmin))).resolves.toBe(true);
  });
});
