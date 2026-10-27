import { ArgumentsHost, Catch, Inject, Logger, type ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { I18nValidationException, I18nService } from 'nestjs-i18n';
import type { ValidationError } from 'class-validator';
import { WS_DEFAULT_LANG, WS_EVENTS, type WsLang } from '../../constants/realtime.constants.js';
import { WS_I18N, type WsI18nKey } from '../../constants/realtime-i18n.constants.js';
import type { I18nTranslate } from '../../types/i18n.types.js';
import type { AuthenticatedSocket, WsExceptionPayload } from '../../types/realtime.types.js';
import { createWsEnvelope } from '../../utils/ws-envelope.util.js';

const CONSTRAINT_I18N: Partial<Record<string, WsI18nKey>> = {
  isNotEmpty: WS_I18N.VALIDATION_REQUIRED,
  isString: WS_I18N.VALIDATION_INVALID,
  isObject: WS_I18N.VALIDATION_INVALID,
  maxLength: WS_I18N.VALIDATION_MAX_LENGTH,
};

@Catch()
export class WsExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(WsExceptionFilter.name);

  constructor(@Inject(I18nService) private readonly i18n: I18nTranslate) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ws = host.switchToWs();
    const client = ws.getClient<AuthenticatedSocket>();
    const lang = client.data?.lang ?? WS_DEFAULT_LANG;
    const payload = this.toPayload(exception, lang);

    this.log(exception, ws.getPattern(), payload.statusCode);
    client.emit(
      WS_EVENTS.SERVER.EXCEPTION,
      createWsEnvelope(WS_EVENTS.SERVER.EXCEPTION, payload, payload.message, payload.statusCode),
    );
  }

  toPayload(exception: unknown, lang: WsLang): WsExceptionPayload {
    if (exception instanceof I18nValidationException) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: this.t(WS_I18N.VALIDATION_ERROR, lang),
        statusCode: exception.getStatus(),
        timestamp: new Date().toISOString(),
        details: this.validationDetails(
          exception.errors,
          exception.errorsAlreadyTranslated,
          lang,
        ),
      };
    }

    if (exception instanceof WsException) {
      return this.wsPayload(exception.getError(), lang);
    }

    return {
      success: false,
      code: 'INTERNAL_ERROR',
      message: this.t(WS_I18N.INTERNAL_ERROR, lang),
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };
  }

  private wsPayload(error: string | object, lang: WsLang): WsExceptionPayload {
    if (typeof error === 'string') {
      return {
        success: false,
        code: 'WS_EXCEPTION',
        message: error,
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };
    }

    const record = (typeof error === 'object' && error !== null ? error : {}) as Partial<
      WsExceptionPayload
    >;
    const payload: WsExceptionPayload = {
      success: false,
      code: typeof record.code === 'string' ? record.code : 'WS_EXCEPTION',
      message:
        typeof record.message === 'string' && record.message.length > 0
          ? record.message
          : this.t(WS_I18N.INTERNAL_ERROR, lang),
      statusCode: typeof record.statusCode === 'number' ? record.statusCode : 400,
      timestamp: new Date().toISOString(),
    };
    if (isDetails(record.details)) {
      payload.details = record.details;
    }
    return payload;
  }

  private validationDetails(
    errors: ValidationError[],
    errorsAlreadyTranslated: boolean,
    lang: WsLang,
  ): Record<string, string[]> {
    const details: Record<string, string[]> = {};
    for (const error of errors) {
      if (!error.constraints) {
        continue;
      }
      details[error.property] = Object.entries(error.constraints).map(
        ([constraint, rawMessage]) =>
          errorsAlreadyTranslated
            ? rawMessage
            : this.localizeConstraint(constraint, error.property, rawMessage, lang),
      );
    }
    return details;
  }

  private localizeConstraint(
    constraint: string,
    property: string,
    rawMessage: string,
    lang: WsLang,
  ): string {
    const key = CONSTRAINT_I18N[constraint];
    return key === undefined ? rawMessage : this.t(key, lang, { property });
  }

  private log(exception: unknown, pattern: string, statusCode: number): void {
    if (statusCode >= 500) {
      this.logger.error(
        `WS "${pattern}" failed with ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }
    this.logger.debug(`WS "${pattern}" rejected with ${statusCode}`);
  }

  private t(key: WsI18nKey, lang: WsLang, args?: Record<string, unknown>): string {
    return this.i18n.t(key, { lang, ...args }) as string;
  }
}

function isDetails(value: unknown): value is Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === 'string'),
  );
}
