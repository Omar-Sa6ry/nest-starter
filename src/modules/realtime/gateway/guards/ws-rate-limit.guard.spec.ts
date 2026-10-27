import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import type { TranslateOptions } from 'nestjs-i18n';
import { WsRateLimitGuard } from './ws-rate-limit.guard.js';
import type { I18nTranslate } from '../../types/i18n.types.js';
import type { AuthenticatedSocket } from '../../types/realtime.types.js';
import { REALTIME_ENV } from '../../constants/realtime.constants.js';
import { WS_I18N } from '../../constants/realtime-i18n.constants.js';

describe('WsRateLimitGuard', () => {
  let translate: Mock<(key: string, options?: TranslateOptions) => string>;
  let mockI18n: I18nTranslate;
  const guards: WsRateLimitGuard[] = [];

  function configWith(values: Record<string, string | undefined>): ConfigService {
    return {
      get: vi.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  function buildGuard(config: ConfigService): WsRateLimitGuard {
    const guard = new WsRateLimitGuard(config, mockI18n);
    guards.push(guard);
    return guard;
  }

  function wsContext(client: unknown): ExecutionContext {
    return {
      getType: () => 'ws',
      switchToWs: () => ({
        getClient: () => client,
        getPattern: () => 'ping',
      }),
    } as unknown as ExecutionContext;
  }

  const httpContext = {
    getType: () => 'http',
  } as unknown as ExecutionContext;

  const authedClient = (userId: string): AuthenticatedSocket =>
    ({
      data: { user: { userId } },
      handshake: {},
    }) as unknown as AuthenticatedSocket;

  beforeEach(() => {
    translate = vi.fn((key: string, _options?: TranslateOptions) => `tx:${key}`);
    mockI18n = { t: translate } as unknown as I18nTranslate;
  });

  afterEach(async () => {
    await Promise.all(guards.splice(0).map((guard) => guard.onModuleDestroy()));
    vi.restoreAllMocks();
  });

  it('allows non-ws contexts untouched', async () => {
    const guard = buildGuard(configWith({}));

    await expect(guard.canActivate(httpContext)).resolves.toBe(true);
  });

  it('allows messages within the limit using env-configured thresholds', async () => {
    const guard = buildGuard(
      configWith({
        [REALTIME_ENV.RATE_LIMIT_MAX]: '2',
        [REALTIME_ENV.RATE_LIMIT_WINDOW_MS]: '60000',
      }),
    );
    const client = authedClient('user-1');

    await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);
    await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);
  });

  it('falls back to defaults when the env thresholds are absent', async () => {
    // Default max is 30: the 31st message inside the window must be rejected.
    const guard = buildGuard(configWith({}));
    const client = authedClient('user-defaults');

    for (let i = 0; i < 30; i += 1) {
      await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);
    }
    await expect(guard.canActivate(wsContext(client))).rejects.toThrow(WsException);
  });

  it('rejects with a localized payload once the limit is exceeded', async () => {
    const guard = buildGuard(
      configWith({
        [REALTIME_ENV.RATE_LIMIT_MAX]: '1',
        [REALTIME_ENV.RATE_LIMIT_WINDOW_MS]: '60000',
      }),
    );
    const client = {
      data: { user: { userId: 'user-1' }, lang: 'ar' },
      handshake: {},
    } as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);

    let thrown: unknown;
    try {
      await guard.canActivate(wsContext(client));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(WsException);
    expect((thrown as WsException).getError()).toEqual({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'tx:realtime.RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      details: { retryAfterSeconds: [expect.stringMatching(/^\d+$/)] },
    });
    expect(translate).toHaveBeenCalledWith(WS_I18N.RATE_LIMIT_EXCEEDED, {
      lang: 'ar',
    });
  });

  it('keys the budget per authenticated user', async () => {
    const guard = buildGuard(
      configWith({ [REALTIME_ENV.RATE_LIMIT_MAX]: '1' }),
    );

    await expect(
      guard.canActivate(wsContext(authedClient('user-1'))),
    ).resolves.toBe(true);
    // A different user still has its own budget.
    await expect(
      guard.canActivate(wsContext(authedClient('user-2'))),
    ).resolves.toBe(true);
    // The first user has exhausted its budget.
    await expect(
      guard.canActivate(wsContext(authedClient('user-1'))),
    ).rejects.toThrow(WsException);
  });

  it('falls back to the handshake address for unauthenticated sockets', async () => {
    const guard = buildGuard(
      configWith({ [REALTIME_ENV.RATE_LIMIT_MAX]: '1' }),
    );
    const anonymous = (address: string): AuthenticatedSocket =>
      ({ data: {}, handshake: { address } }) as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(anonymous('10.0.0.1')))).resolves.toBe(true);
    await expect(guard.canActivate(wsContext(anonymous('10.0.0.1')))).rejects.toThrow(
      WsException,
    );
    // A different address has its own budget.
    await expect(guard.canActivate(wsContext(anonymous('10.0.0.2')))).resolves.toBe(true);
  });

  it('falls back to the anonymous key when no identifier exists at all', async () => {
    const guard = buildGuard(
      configWith({ [REALTIME_ENV.RATE_LIMIT_MAX]: '1' }),
    );
    const client = { data: undefined, handshake: {} } as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);
    await expect(guard.canActivate(wsContext(client))).rejects.toThrow(WsException);
  });

  it('localizes the default language when the client has none', async () => {
    const guard = buildGuard(
      configWith({ [REALTIME_ENV.RATE_LIMIT_MAX]: '1' }),
    );
    const client = {
      data: { user: { userId: 'user-1' } },
      handshake: {},
    } as unknown as AuthenticatedSocket;

    await expect(guard.canActivate(wsContext(client))).resolves.toBe(true);
    await expect(guard.canActivate(wsContext(client))).rejects.toThrow(WsException);

    expect(translate).toHaveBeenCalledWith(WS_I18N.RATE_LIMIT_EXCEEDED, {
      lang: 'en',
    });
  });

  it('ignores invalid env thresholds in favour of the defaults', async () => {
    const guard = buildGuard(
      configWith({
        [REALTIME_ENV.RATE_LIMIT_MAX]: 'not-a-number',
        [REALTIME_ENV.RATE_LIMIT_WINDOW_MS]: '-5',
      }),
    );

    await expect(guard.canActivate(wsContext(authedClient('user-1')))).resolves.toBe(
      true,
    );
  });

  it('destroys the limiter store on module destroy', async () => {
    const guard = buildGuard(configWith({}));

    await expect(guard.onModuleDestroy()).resolves.toBeUndefined();
  });
});
