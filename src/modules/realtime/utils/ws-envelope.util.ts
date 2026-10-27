import type { WsEnvelope } from '../types/realtime.types.js';

export function createWsEnvelope<T>(
  event: string,
  data: T,
  message = '',
  statusCode = 200,
  success = statusCode < 400,
): WsEnvelope<T> {
  return {
    success,
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    event,
    data,
  };
}
