import { describe, it, expect, beforeEach, afterEach, vi, type Mock, type MockInstance } from 'vitest';
import { Logger, type ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { I18nValidationException } from 'nestjs-i18n';
import type { TranslateOptions } from 'nestjs-i18n';
import type { ValidationError } from 'class-validator';
import { WsExceptionFilter } from './ws-exception.filter.js';
import type { I18nTranslate } from '../../types/i18n.types.js';
import type { AuthenticatedSocket } from '../../types/realtime.types.js';
import { wsError } from '../../utils/ws-errors.util.js';

describe('WsExceptionFilter', () => {
  let translate: Mock<(key: string, options?: TranslateOptions) => string>;
  let filter: WsExceptionFilter;
  let debugSpy: MockInstance;
  let errorSpy: MockInstance;

  function wsHost(client: unknown, pattern = 'join_room'): ArgumentsHost {
    return {
      switchToWs: () => ({
        getClient: () => client,
        getPattern: () => pattern,
      }),
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    translate = vi.fn(
      (key: string, options?: TranslateOptions) =>
        `${key}:${JSON.stringify(options ?? {})}`,
    );
    const mockI18n = { t: translate } as unknown as I18nTranslate;
    filter = new WsExceptionFilter(mockI18n);
    debugSpy = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toPayload', () => {
    it('localizes an I18nValidationException into a VALIDATION_ERROR payload', () => {
      const exception = new I18nValidationException([
        { property: 'room', constraints: { isNotEmpty: 'raw' } } as ValidationError,
      ]);

      expect(filter.toPayload(exception, 'en')).toEqual({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'realtime.VALIDATION_ERROR:{"lang":"en"}',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        details: {
          room: ['realtime.VALIDATION_REQUIRED:{"lang":"en","property":"room"}'],
        },
      });
    });

    it('maps every supported constraint and keeps unknown ones raw', () => {
      const exception = new I18nValidationException([
        {
          property: 'payload',
          constraints: {
            isNotEmpty: 'raw required',
            maxLength: 'raw max length',
            isString: 'raw string',
            isObject: 'raw object',
            isEmail: 'raw email',
          },
        } as ValidationError,
      ]);

      expect(filter.toPayload(exception, 'ar')).toEqual({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'realtime.VALIDATION_ERROR:{"lang":"ar"}',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        details: {
          payload: [
            'realtime.VALIDATION_REQUIRED:{"lang":"ar","property":"payload"}',
            'realtime.VALIDATION_MAX_LENGTH:{"lang":"ar","property":"payload"}',
            'realtime.VALIDATION_INVALID:{"lang":"ar","property":"payload"}',
            'realtime.VALIDATION_INVALID:{"lang":"ar","property":"payload"}',
            'raw email',
          ],
        },
      });
    });

    it('keeps raw messages when the exception says they are already translated', () => {
      const exception = new I18nValidationException(
        [
          {
            property: 'room',
            constraints: { isNotEmpty: 'already localized' },
          } as ValidationError,
        ],
        400,
        true,
      );

      expect(filter.toPayload(exception, 'en')).toEqual({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'realtime.VALIDATION_ERROR:{"lang":"en"}',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        details: { room: ['already localized'] },
      });
    });

    it('skips validation errors that carry no constraints', () => {
      const exception = new I18nValidationException([
        { property: 'ghost' } as ValidationError,
        { property: 'room', constraints: { isNotEmpty: 'raw' } } as ValidationError,
      ]);

      const payload = filter.toPayload(exception, 'en');

      expect(payload.details).toEqual({
        room: ['realtime.VALIDATION_REQUIRED:{"lang":"en","property":"room"}'],
      });
      expect(payload.details).not.toHaveProperty('ghost');
    });

    it('keeps the thrower message for the string WsException shorthand', () => {
      expect(filter.toPayload(new WsException('boom'), 'en')).toEqual({
        success: false,
        code: 'WS_EXCEPTION',
        message: 'boom',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });

    it('passes a full wsError payload through untouched', () => {
      expect(
        filter.toPayload(wsError('UNAUTHORIZED', 'msg', 401, { k: ['v'] }), 'en'),
      ).toEqual({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'msg',
        statusCode: 401,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        details: { k: ['v'] },
      });
    });

    it('applies defensive fallbacks to a hand-built partial payload', () => {
      expect(filter.toPayload(new WsException({ code: 'X' }), 'en')).toEqual({
        success: false,
        code: 'X',
        message: 'realtime.INTERNAL_ERROR:{"lang":"en"}',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(
        filter.toPayload(
          new WsException({ code: 5, message: '', statusCode: '400' }),
          'en',
        ),
      ).toEqual({
        success: false,
        code: 'WS_EXCEPTION',
        message: 'realtime.INTERNAL_ERROR:{"lang":"en"}',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });

    it('omits malformed details breakdowns', () => {
      const malformed: unknown[] = [
        { a: 'not-array' },
        { a: ['ok', 2] },
        ['array-at-top'],
        null,
        'plain-string',
      ];

      for (const details of malformed) {
        const payload = filter.toPayload(
          new WsException({ code: 'X', message: 'm', statusCode: 400, details }),
          'en',
        );
        expect(payload).toEqual({
          success: false,
          code: 'X',
          message: 'm',
          statusCode: 400,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        });
        expect(payload).not.toHaveProperty('details');
      }
    });

    it('keeps an empty details map as a valid breakdown', () => {
      const payload = filter.toPayload(
        new WsException({ code: 'X', message: 'm', statusCode: 400, details: {} }),
        'en',
      );

      expect(payload.details).toEqual({});
    });

    it('falls back for a non-string primitive exception body', () => {
      expect(filter.toPayload(new WsException(42 as unknown as string), 'en')).toEqual({
        success: false,
        code: 'WS_EXCEPTION',
        message: 'realtime.INTERNAL_ERROR:{"lang":"en"}',
        statusCode: 400,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });

    it('answers a generic INTERNAL_ERROR for unknown exceptions', () => {
      expect(filter.toPayload(new Error('boom'), 'en')).toEqual({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'realtime.INTERNAL_ERROR:{"lang":"en"}',
        statusCode: 500,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });
  });

  describe('catch', () => {
    it('emits a 4xx payload on the exception event and only debug-logs it', () => {
      const emit = vi.fn();
      const client = {
        data: { lang: 'ar' },
        emit,
      } as unknown as AuthenticatedSocket;

      filter.catch(wsError('X', 'm', 400), wsHost(client, 'join_room'));

      expect(emit).toHaveBeenCalledWith('exception', {
        success: false,
        statusCode: 400,
        message: 'm',
        event: 'exception',
        data: {
          success: false,
          code: 'X',
          message: 'm',
          statusCode: 400,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(debugSpy).toHaveBeenCalledWith('WS "join_room" rejected with 400');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('emits a 500 payload and logs the stack for a failed Error', () => {
      const emit = vi.fn();
      const client = {
        data: { lang: 'ar' },
        emit,
      } as unknown as AuthenticatedSocket;
      const exception = new Error('boom');

      filter.catch(exception, wsHost(client, 'join_room'));

      expect(emit).toHaveBeenCalledWith('exception', {
        success: false,
        statusCode: 500,
        message: 'realtime.INTERNAL_ERROR:{"lang":"ar"}',
        event: 'exception',
        data: {
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'realtime.INTERNAL_ERROR:{"lang":"ar"}',
          statusCode: 500,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'WS "join_room" failed with 500',
        exception.stack,
      );
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('logs the string form when a 5xx exception is not an Error', () => {
      const emit = vi.fn();
      const client = {
        data: undefined,
        emit,
      } as unknown as AuthenticatedSocket;

      filter.catch('raw string failure', wsHost(client, 'join_room'));

      expect(emit).toHaveBeenCalledWith('exception', {
        success: false,
        statusCode: 500,
        message: 'realtime.INTERNAL_ERROR:{"lang":"en"}',
        event: 'exception',
        data: {
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'realtime.INTERNAL_ERROR:{"lang":"en"}',
          statusCode: 500,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'WS "join_room" failed with 500',
        'raw string failure',
      );
    });
  });
});
