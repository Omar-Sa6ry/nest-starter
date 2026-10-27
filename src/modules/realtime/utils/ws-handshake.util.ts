import {
  WS_DEFAULT_LANG,
  WS_LANGS,
  type WsLang,
} from '../constants/realtime.constants.js';
import {
  WS_AUTH_FIELD,
  WS_AUTH_HEADER,
  WS_BEARER_PREFIX,
  WS_LANG_HEADER,
  WS_LANG_QUERY_PARAM,
  WS_TOKEN_QUERY_PARAM,
} from '../constants/realtime-i18n.constants.js';
import type { WsHandshake } from '../types/realtime.types.js';

/**
 * Reads the bearer token off a socket.io handshake.
 *
 * Three carriers are honoured, in order of reliability:
 *  1. `Authorization: Bearer <jwt>` — the standard header;
 *  2. `auth: { token }` — socket.io's native auth payload (browser friendly);
 *  3. `?token=` — query string for clients that can set neither of the above.
 *
 * يقرأ رمز الوصول من مصافحة socket.io عبر الترويسة أو حقل auth أو الاستعلام.
 */
export function extractToken(handshake: WsHandshake): string | null {
  const header = firstString(handshake.headers[WS_AUTH_HEADER]);
  if (header?.startsWith(WS_BEARER_PREFIX)) {
    const token = header.slice(WS_BEARER_PREFIX.length).trim();
    if (token.length > 0) return token;
  }

  const auth = handshake.auth as Record<string, unknown> | undefined;
  const authToken = firstString(auth?.[WS_AUTH_FIELD]);
  if (authToken && authToken.length > 0) return authToken;

  const queryToken = firstString(handshake.query?.[WS_TOKEN_QUERY_PARAM]);
  return queryToken && queryToken.length > 0 ? queryToken : null;
}

export function resolveLang(handshake: WsHandshake): WsLang {
  const carriers = [
    firstString(handshake.query?.[WS_LANG_QUERY_PARAM]),
    firstString(handshake.headers[WS_LANG_HEADER]),
    firstString(handshake.headers['accept-language']),
  ];
  for (const carrier of carriers) {
    const matched = matchLang(carrier);
    if (matched) {
      return matched;
    }
  }
  return WS_DEFAULT_LANG;
}

function matchLang(value: string | undefined): WsLang | null {
  if (!value) return null;
  for (const entry of value.split(',')) {
    const primary = entry.split(';')[0]?.trim().split('-')[0]?.toLowerCase();
    if (primary && WS_LANGS.includes(primary as WsLang)) {
      return primary as WsLang;
    }
  }
  return null;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }
  return undefined;
}
