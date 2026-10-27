export const WS_AUTH_HEADER = 'authorization';
export const WS_BEARER_PREFIX = 'Bearer ';
export const WS_AUTH_FIELD = 'token';
export const WS_TOKEN_QUERY_PARAM = 'token';

export const WS_LANG_HEADER = 'x-lang';
export const WS_LANG_QUERY_PARAM = 'lang';

export const WS_I18N = {
  UNAUTHORIZED: 'realtime.UNAUTHORIZED',
  RATE_LIMIT_EXCEEDED: 'realtime.RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'realtime.VALIDATION_ERROR',
  VALIDATION_REQUIRED: 'realtime.VALIDATION_REQUIRED',
  VALIDATION_INVALID: 'realtime.VALIDATION_INVALID',
  VALIDATION_MAX_LENGTH: 'realtime.VALIDATION_MAX_LENGTH',
  INTERNAL_ERROR: 'realtime.INTERNAL_ERROR',
  INSUFFICIENT_PERMISSIONS: 'realtime.INSUFFICIENT_PERMISSIONS',
  ROOM_JOINED: 'realtime.ROOM_JOINED',
  ROOM_LEFT: 'realtime.ROOM_LEFT',
} as const;

export type WsI18nKey = (typeof WS_I18N)[keyof typeof WS_I18N];
