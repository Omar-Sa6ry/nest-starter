import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common';
import type { WsResponse } from '@nestjs/websockets';
import { Observable, filter, map } from 'rxjs';
import { createWsEnvelope } from '../../utils/ws-envelope.util.js';
import type { WsEnvelope } from '../../types/realtime.types.js';

@Injectable()
export class WsResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    if (context.getType() !== 'ws') {
      return next.handle();
    }
    return next.handle().pipe(
      filter((result): result is WsResponse<unknown> => isWsResponse(result)),
      map(
        (result): WsResponse<WsEnvelope> => ({
          event: result.event,
          data: createWsEnvelope(result.event, result.data),
        }),
      ),
    );
  }
}

function isWsResponse(value: unknown): value is WsResponse<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return typeof (value as { event?: unknown }).event === 'string';
}
