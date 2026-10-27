import { describe, it, expect } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom, toArray } from 'rxjs';
import { WsResponseInterceptor } from './ws-response.interceptor.js';

describe('WsResponseInterceptor', () => {
  const interceptor = new WsResponseInterceptor();

  function wsContext(): ExecutionContext {
    return {
      getType: () => 'ws',
      switchToWs: () => ({
        getClient: () => ({}),
        getPattern: () => 'ping',
      }),
    } as unknown as ExecutionContext;
  }

  const httpContext = {
    getType: () => 'http',
  } as unknown as ExecutionContext;

  function handlerOf(result: unknown): CallHandler<unknown> {
    return {
      handle: () => of(result),
    } as unknown as CallHandler<unknown>;
  }

  it('passes a non-ws context straight through to the handler observable', async () => {
    const raw = { anything: true };

    const emitted = await lastValueFrom(
      interceptor.intercept(httpContext, handlerOf(raw)).pipe(toArray()),
    );

    expect(emitted).toEqual([raw]);
    expect(emitted[0]).toBe(raw);
  });

  it('wraps a WsResponse in the shared envelope with a nested data payload', async () => {
    const emitted = await lastValueFrom(
      interceptor
        .intercept(
          wsContext(),
          handlerOf({ event: 'room_joined', data: { room: 'r' } }),
        )
        .pipe(toArray()),
    );

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      event: 'room_joined',
      data: {
        success: true,
        statusCode: 200,
        message: '',
        event: 'room_joined',
        data: { room: 'r' },
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
  });

  it('drops a void handler reply instead of emitting on a guessed event', async () => {
    const emitted = await lastValueFrom(
      interceptor.intercept(wsContext(), handlerOf(undefined)).pipe(toArray()),
    );

    expect(emitted).toEqual([]);
  });

  it('drops results that declare no string event', async () => {
    const dropped = [
      { foo: 1 },
      { event: 42 },
      null,
      'plain string',
      7,
    ];

    for (const result of dropped) {
      const emitted = await lastValueFrom(
        interceptor.intercept(wsContext(), handlerOf(result)).pipe(toArray()),
      );
      expect(emitted).toEqual([]);
    }
  });
});
