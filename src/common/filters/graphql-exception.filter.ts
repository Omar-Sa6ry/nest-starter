import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';
import { ResponseFormatter } from '../interceptors/response-formatter.js';
import type { IFormattedErrorEnvelope } from '../interfaces/IResponse-formatter.interface.js';

interface IExceptionExtensions {
  code?: string;
  statusCode?: number;
  [key: string]: unknown;
}

interface IExceptionLike {
  status?: number;
  statusCode?: number;
  message?: string;
  extensions?: IExceptionExtensions;
  response?: unknown;
  getResponse?: () => unknown;
}

function readMessage(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined;
  const { message } = payload as { message?: unknown };
  return typeof message === 'string' ? message : undefined;
}

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
      this.logHttpException(
        exception,
        formattedError.statusCode,
        formattedError.message,
      );
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
          (formattedError.statusCode === 400
            ? 'BAD_REQUEST'
            : 'INTERNAL_SERVER_ERROR'),
      },
    });
  }

  private extractStatusCode(exception: unknown): number {
    const err = exception as IExceptionLike | null;
    return err?.extensions?.statusCode || err?.status || err?.statusCode || 500;
  }

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

  private sendHttpError(
    host: ArgumentsHost,
    formatted: IFormattedErrorEnvelope,
  ): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (!res || res.headersSent) return;

    res.status(formatted.statusCode).json({
      success: false,
      statusCode: formatted.statusCode,
      message: formatted.message,
      timeStamp: formatted.timeStamp,
      timestamp: formatted.timestamp,
    });
  }
}
