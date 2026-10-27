import { describe, it, expect, vi, afterEach } from 'vitest';
import { WsException } from '@nestjs/websockets';
import { wsError } from './ws-errors.util.js';
import type { WsExceptionPayload } from '../types/realtime.types.js';

describe('wsError', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a WsException carrying the full aligned payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T10:00:00.000Z'));

    const error = wsError('UNAUTHORIZED', 'Unauthorized', 401);

    expect(error).toBeInstanceOf(WsException);
    const payload = error.getError() as WsExceptionPayload;
    expect(payload.success).toBe(false);
    expect(payload.code).toBe('UNAUTHORIZED');
    expect(payload.message).toBe('Unauthorized');
    expect(payload.statusCode).toBe(401);
    expect(payload.timestamp).toBe('2024-05-01T10:00:00.000Z');
  });

  it('omits the details key when details are not provided', () => {
    const payload = wsError('INTERNAL_ERROR', 'Internal error', 500)
      .getError() as WsExceptionPayload;

    expect('details' in payload).toBe(false);
  });

  it('includes the details breakdown when provided', () => {
    const details = { name: ['Name is required'], email: ['Invalid email'] };
    const error = wsError('VALIDATION_ERROR', 'Validation failed', 400, details);
    const payload = error.getError() as WsExceptionPayload;

    expect(payload.success).toBe(false);
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.message).toBe('Validation failed');
    expect(payload.statusCode).toBe(400);
    expect(payload.details).toEqual(details);
  });

  it('always includes a valid ISO timestamp', () => {
    const payload = wsError('INTERNAL_ERROR', 'err', 500).getError() as WsExceptionPayload;
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });
});
