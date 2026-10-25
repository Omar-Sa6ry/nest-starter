import { describe, it, expect } from 'vitest';
import type { GraphQLFormattedError } from 'graphql';
import { formatGraphQLError } from './graphql-error.formatter.js';

const asError = (value: Record<string, unknown>) =>
  value as unknown as GraphQLFormattedError;

describe('formatGraphQLError', () => {
  it('flattens an error produced by GraphQLExceptionFilter', () => {
    const result = formatGraphQLError(
      asError({
        message: 'User not found',
        path: ['getUser'],
        locations: [{ line: 27, column: 3 }],
        extensions: {
          success: false,
          statusCode: 404,
          timestamp: '2026-10-25T10:15:30.123Z',
          code: 'INTERNAL_SERVER_ERROR',
          stacktrace: ['GraphQLError: User not found'],
        },
      }),
    );

    expect(result).toEqual({
      message: 'User not found',
      success: false,
      statusCode: 404,
      timestamp: '2026-10-25T10:15:30.123Z',
    });
    // nothing else survives: no path / locations / extensions / stacktrace
    expect(Object.keys(result).sort()).toEqual([
      'message',
      'statusCode',
      'success',
      'timestamp',
    ]);
  });

  it('keeps the legacy timeStamp key of older exceptions', () => {
    const result = formatGraphQLError(
      asError({
        message: 'stale',
        extensions: { statusCode: 401, timeStamp: '2026-01-01T00:00:00.000Z' },
      }),
    );

    expect(result.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(result.statusCode).toBe(401);
  });

  it('maps Apollo validation errors to 400 and generates a timestamp', () => {
    const result = formatGraphQLError(
      asError({
        message: 'Cannot query field "x" on type "Query".',
        locations: [{ line: 1, column: 9 }],
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      }),
    );

    expect(result).toEqual({
      message: 'Cannot query field "x" on type "Query".',
      success: false,
      statusCode: 400,
      timestamp: expect.any(String),
    });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it.each([
    ['GRAPHQL_PARSE_FAILED', 400],
    ['BAD_USER_INPUT', 400],
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['INTERNAL_SERVER_ERROR', 500],
  ])('maps code %s to status %i', (code, statusCode) => {
    const result = formatGraphQLError(
      asError({ message: 'x', extensions: { code } }),
    );

    expect(result.statusCode).toBe(statusCode);
  });

  it('reads status (Nest HTTP transform) when statusCode is missing', () => {
    const result = formatGraphQLError(
      asError({ message: 'nope', extensions: { status: 405 } }),
    );

    expect(result.statusCode).toBe(405);
  });

  it('reads extensions.http.status for HTTP-layer errors', () => {
    const result = formatGraphQLError(
      asError({
        message: 'GET query missing.',
        extensions: { http: { status: 400 } },
      }),
    );

    expect(result.statusCode).toBe(400);
  });

  it('accepts string status codes', () => {
    const result = formatGraphQLError(
      asError({ message: 'x', extensions: { statusCode: '403' } }),
    );

    expect(result.statusCode).toBe(403);
  });

  it('falls back to 500 for unknown codes', () => {
    const result = formatGraphQLError(
      asError({ message: 'x', extensions: { code: 'SOMETHING_NEW' } }),
    );

    expect(result.statusCode).toBe(500);
  });

  it('handles an error without extensions', () => {
    const result = formatGraphQLError(asError({ message: 'plain' }));

    expect(result).toEqual({
      message: 'plain',
      success: false,
      statusCode: 500,
      timestamp: expect.any(String),
    });
  });

  it('merges an array message into a single line', () => {
    const result = formatGraphQLError(
      asError({ message: ['name is required', 'email is invalid'] }),
    );

    expect(result.message).toBe('name is required, email is invalid');
  });

  it('falls back when the message is empty', () => {
    const result = formatGraphQLError(asError({ message: '' }));

    expect(result.message).toBe('An unexpected error occurred');
  });
});
