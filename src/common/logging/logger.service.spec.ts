import { vi } from 'vitest';
import { StructuredLogger } from './logger.service.js';
import { LoggerContext } from './logger.context.js';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;
  const originalLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    logger = new StructuredLogger();
    process.env.NODE_ENV = 'test';
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
    if (originalLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLevel;
    }
  });

  it('logs an INFO line with the default Application context', () => {
    logger.log('service started');

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('[INFO]');
    expect(output).toContain('[Application]');
    expect(output).toContain('service started');
  });

  it('logs with an explicit context', () => {
    logger.log('authenticated', 'Auth');

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('[Auth]');
    expect(output).not.toContain('[Application]');
  });

  it('includes the trace id coming from the log context', () => {
    LoggerContext.run({ traceId: 'trace-42', userId: 'user-7' }, () => {
      logger.log('with trace', 'Orders');
    });

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('[TraceID: trace-42]');
    expect(output).toContain('[Orders]');
  });

  it('pretty prints object messages', () => {
    logger.log({ a: 1, b: 'two' }, 'Payload');

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain(JSON.stringify({ a: 1, b: 'two' }, null, 2));
  });

  it('colors ERROR, WARN, INFO, DEBUG and VERBOSE lines', () => {
    logger.error('bad thing', undefined, 'Ctx');
    logger.warn('careful');
    logger.debug('chatter');
    logger.verbose('quiet');
    logger.log('plain');

    expect(errorSpy.mock.calls[0][0]).toContain('\x1b[31m[ERROR]');
    expect(warnSpy.mock.calls[0][0]).toContain('\x1b[33m[WARN]');
    expect(logSpy.mock.calls[0][0]).toContain('\x1b[35m[DEBUG]');
    expect(logSpy.mock.calls[1][0]).toContain('\x1b[36m[VERBOSE]');
    expect(logSpy.mock.calls[2][0]).toContain('\x1b[32m[INFO]');
  });

  it('suppresses records below LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';

    logger.debug('chatter');
    logger.log('started');
    logger.warn('degraded');
    logger.error('broken');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts verbose level configuration', () => {
    process.env.LOG_LEVEL = 'verbose';

    logger.verbose('quiet');
    logger.debug('chatter');
    logger.log('started');

    expect(logSpy).toHaveBeenCalledTimes(3);
  });

  it('accepts debug level configuration', () => {
    process.env.LOG_LEVEL = 'DEBUG';

    logger.debug('chatter');
    logger.log('started');

    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to info when LOG_LEVEL is unknown', () => {
    process.env.LOG_LEVEL = 'not-a-level';

    logger.debug('chatter');
    logger.log('started');

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('treats warning alias as warn level', () => {
    process.env.LOG_LEVEL = 'warning';
    process.env.NODE_ENV = 'production';

    logger.warn('careful');
    logger.log('started');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('defaults to info level in production when LOG_LEVEL is unset', () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'production';

    logger.debug('chatter');
    logger.log('started');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('"level":"INFO"');
  });

  it('writes the stack trace separately when not in production', () => {
    logger.error('boom', 'Error: boom\n    at somewhere', 'Http');

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[0][0]).toContain('[Http]');
    expect(errorSpy.mock.calls[0][0]).toContain('boom');
    expect(errorSpy.mock.calls[1][0]).toBe('Error: boom\n    at somewhere');
  });

  it('falls back to the trace argument as context', () => {
    logger.error('boom', 'fallback-trace');

    expect(errorSpy.mock.calls[0][0]).toContain('[fallback-trace]');
  });

  it('skips the extra stack line in production', () => {
    process.env.NODE_ENV = 'production';

    logger.error('boom', 'stack-line', 'Http');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('emits machine readable json in production', () => {
    process.env.NODE_ENV = 'production';

    LoggerContext.run({ traceId: 'prod-trace' }, () => {
      logger.log('shipped', 'Shipper');
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: 'INFO',
      context: 'Shipper',
      message: { text: 'shipped' },
      traceId: 'prod-trace',
    });
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('keeps object payloads as objects in production json', () => {
    process.env.NODE_ENV = 'production';

    logger.log({ code: 42 });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.message).toEqual({ code: 42 });
    expect(parsed.context).toBe('Application');
  });

  it('propagates log calls through the Nest LoggerService contract', () => {
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.verbose).toBe('function');

    logger.warn('heads up', 'Warn');
    expect(warnSpy.mock.calls[0][0]).toContain('[WARN]');
    expect(warnSpy.mock.calls[0][0]).toContain('[Warn]');
  });

  it('masks key=value secrets inside string messages', () => {
    logger.log('connecting with password=supersecret123 and token: abc-123-token');

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('password=***');
    expect(output).toContain('token: ***');
    expect(output).not.toContain('supersecret123');
    expect(output).not.toContain('abc-123-token');
  });

  it('masks sensitive keys inside object payloads', () => {
    logger.log({ user: 'omar', DB_PASSWORD: 'pg-secret-value', nested: { apiKey: 'key-123' } });

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('"user": "omar"');
    expect(output).toContain('"DB_PASSWORD": "***"');
    expect(output).toContain('"apiKey": "***"');
    expect(output).not.toContain('pg-secret-value');
    expect(output).not.toContain('key-123');
  });

  it('masks bearer tokens, JWTs and webhook urls', () => {
    logger.log(
      'auth Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-nature at https://discordapp.com/api/webhooks/123456/zzz-webhook-secret done',
    );

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).not.toContain('sig-nature');
    expect(output).not.toContain('zzz-webhook-secret');
    expect(output).toContain('Bearer ***');
    expect(output).toContain('/webhooks/123456/***');
  });

  it('masks secrets in the separately written stack trace', () => {
    logger.error('boom', 'Error: auth failed password=topsecret999\n    at somewhere', 'Http');

    expect(errorSpy.mock.calls[1][0]).toContain('password=***');
    expect(errorSpy.mock.calls[1][0]).not.toContain('topsecret999');
  });

  it('redacts sensitive fields in production json output', () => {
    process.env.NODE_ENV = 'production';

    logger.log({ jwt_secret: 'prod-secret-value', note: 'ok' });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.message).toEqual({ jwt_secret: '***', note: 'ok' });
    expect(JSON.stringify(parsed)).not.toContain('prod-secret-value');
  });
});
