import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';
import { ResponseFormatter } from '../interceptors/response-formatter.js';
import type { IFormattedErrorEnvelope } from '../interfaces/IResponse-formatter.interface.js';

/**
 * `extensions` of an incoming exception. Only `code` and `statusCode` are
 * strongly typed because those are the two keys this filter reads or writes;
 * everything else is carried through untouched.
 */
interface IExceptionExtensions {
  code?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Structural shape of a non-`HttpException` exception. Declaring the contract
 * explicitly lets the filter stay 100% `any`-free while still coping with
 * Apollo `GraphQLError`, class-validator payloads and ad-hoc plain objects.
 */
interface IExceptionLike {
  status?: number;
  statusCode?: number;
  message?: string;
  extensions?: IExceptionExtensions;
  response?: unknown;
  getResponse?: () => unknown;
}

/**
 * Reads `message` off an unknown payload (`getResponse()`, `err.response`, …)
 * and returns `undefined` unless it really is a string — the caller then falls
 * back to the exception's own message.
 */
function readMessage(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined;
  const { message } = payload as { message?: unknown };
  return typeof message === 'string' ? message : undefined;
}

/**
 * Global exception filter (`APP_FILTER`).
 *
 * - GraphQL context  -> `GraphQLError` carrying `extensions.statusCode` and
 *   `extensions.timestamp`; Apollo's `formatError`
 *   (`common/graphql/graphql-error.formatter.ts`) then flattens the error to
 *   `{ message, success, statusCode, timestamp }` — no `locations`, `path`,
 *   `extensions` or `stacktrace` reach the client.
 * - HTTP context     -> the same four fields as a JSON body plus the proper
 *   status code (no GraphQL error object).
 *
 * The HTTP branch is required because this filter is registered globally: without
 * it, a plain REST 404 ("Cannot GET /api/health") would be logged as a GraphQL
 * exception with a full stack trace and answered with a GraphQLError payload.
 */
@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GraphQLExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | undefined {
    const isHttp = host.getType<string>() === 'http';

    let statusCode = this.extractStatusCode(exception);
    let message: string =
      (exception as { message?: string } | null)?.message ??
      'An unexpected error occurred';
    let response: unknown = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      response = exception.getResponse();
      message = readMessage(response) || exception.message;
    } else if (exception && typeof exception === 'object') {
      const err = exception as IExceptionLike;
      const status = err.status || err.statusCode || err.extensions?.statusCode;
      if (status) statusCode = status;
      if (typeof err.getResponse === 'function') {
        response = err.getResponse();
      } else if (err.response) {
        response = err.response;
      }
      message = readMessage(response) || err.message || message;
    }

    const extensions = (exception as IExceptionLike | null)?.extensions;

    const formattedError = ResponseFormatter.formatError({
      message,
      response,
      statusCode,
      extensions,
    });

    if (isHttp) {
      this.logHttpException(exception, formattedError.statusCode, formattedError.message);
      this.sendHttpError(host, formattedError);
      return undefined;
    }

    this.logGraphqlException(exception);

    // `extensions` is only a carrier between this filter and Apollo's
    // `formatError` (see graphql-error.formatter.ts) — the response the client
    // receives is the flat { message, success, statusCode, timestamp } object.
    return new GraphQLError(formattedError.message, {
      extensions: {
        ...extensions,
        success: false,
        statusCode: formattedError.statusCode,
        timestamp: formattedError.timestamp,
        code:
          extensions?.code ||
          (formattedError.statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR'),
      },
    });
  }

  private extractStatusCode(exception: unknown): number {
    const err = exception as IExceptionLike | null;
    return err?.extensions?.statusCode || err?.status || err?.statusCode || 500;
  }

  /** Keeps the original GraphQL logging contract (message + stack / JSON blob). */
  private logGraphqlException(exception: unknown): void {
    if (exception instanceof Error) {
      this.logger.error(
        `GraphQL Exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error('GraphQL Exception', JSON.stringify(exception));
    }
  }

  /**
   * HTTP logging: client errors (4xx — including routine route 404s) are a
   * single WARN line without a stack trace, only server errors (5xx) are ERROR.
   */
  private logHttpException(
    exception: unknown,
    statusCode: number,
    message: string,
  ): void {
    if (statusCode >= 500) {
      this.logger.error(
        `HTTP Exception: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      return;
    }
    this.logger.warn(`HTTP ${statusCode}: ${message}`);
  }

  /** Sends exactly the API error contract: { success, statusCode, message, timestamp }. */
  private sendHttpError(host: ArgumentsHost, formatted: IFormattedErrorEnvelope): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (!res || res.headersSent) return;

    res.status(formatted.statusCode).json({
      success: false,
      statusCode: formatted.statusCode,
      message: formatted.message,
      timestamp: formatted.timestamp,
    });
  }
}
