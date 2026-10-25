import { describe, it, expect } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import { GraphQLResponseInterceptor } from './graphql-response.interceptor.js';

describe('GraphQLResponseInterceptor', () => {
  const interceptor = new GraphQLResponseInterceptor();

  function buildContext(type: string) {
    return { getType: () => type } as never;
  }

  function buildNext(data: unknown) {
    return { handle: () => of(data) } as never;
  }

  it('formats graphql payloads', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(buildContext('graphql'), buildNext({ id: '1' })),
    );

    expect(result).toMatchObject({
      success: true,
      statusCode: 200,
      data: { id: '1' },
    });
  });

  it('passes through already-formatted graphql payloads', async () => {
    const formatted = {
      success: true,
      statusCode: 201,
      message: 'Created',
      data: { id: '1' },
    };

    const result = await lastValueFrom(
      interceptor.intercept(buildContext('graphql'), buildNext(formatted)),
    );

    expect(result).toBe(formatted);
  });

  it('passes through non-graphql responses untouched', async () => {
    const raw = { id: '1' };

    const result = await lastValueFrom(
      interceptor.intercept(buildContext('http'), buildNext(raw)),
    );

    expect(result).toBe(raw);
  });
});
