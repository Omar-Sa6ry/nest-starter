import { describe, it, expect, afterEach, vi } from 'vitest';
import { createWsEnvelope } from './ws-envelope.util.js';

describe('createWsEnvelope', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds the standardized envelope shape with defaults', () => {
    const envelope = createWsEnvelope('pong', { serverTime: 42 });

    expect(envelope.event).toBe('pong');
    expect(envelope.data).toEqual({ serverTime: 42 });
    expect(envelope.success).toBe(true);
    expect(envelope.statusCode).toBe(200);
    expect(envelope.message).toBe('');
    // The timestamp must always be a parseable ISO-8601 date.
    expect(Number.isNaN(Date.parse(envelope.timestamp))).toBe(false);
  });

  it('produces the exact ISO timestamp of the current clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T10:00:00.000Z'));

    const envelope = createWsEnvelope('presence', null);

    expect(envelope).toEqual({
      success: true,
      statusCode: 200,
      message: '',
      event: 'presence',
      data: null,
      timestamp: '2024-05-01T10:00:00.000Z',
    });
  });

  it('accepts a custom message and statusCode', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T10:00:00.000Z'));

    const envelope = createWsEnvelope('room_joined', { room: 'lobby' }, 'Joined!', 201);

    expect(envelope).toEqual({
      success: true,
      statusCode: 201,
      message: 'Joined!',
      event: 'room_joined',
      data: { room: 'lobby' },
      timestamp: '2024-05-01T10:00:00.000Z',
    });
  });

  it('passes through primitives and undefined data untouched', () => {
    const withUndefined = createWsEnvelope('noop', undefined);

    expect(withUndefined.event).toBe('noop');
    expect(withUndefined.data).toBeUndefined();
    expect(typeof withUndefined.timestamp).toBe('string');
    expect(withUndefined.success).toBe(true);
    expect(withUndefined.statusCode).toBe(200);
  });
});
