import { WsException } from '@nestjs/websockets';
import type { WsExceptionPayload } from '../types/realtime.types.js';

export function wsError(
  code: string,
  message: string,
  statusCode: number,
  details?: Record<string, string[]>,
): WsException {
  const payload: WsExceptionPayload = {
    success: false,
    code,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  if (details) {
    payload.details = details;
  }
  return new WsException(payload);
}
