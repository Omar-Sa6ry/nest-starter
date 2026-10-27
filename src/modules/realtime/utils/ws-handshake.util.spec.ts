import { describe, it, expect } from 'vitest';
import { extractToken, resolveLang } from './ws-handshake.util.js';
import type { WsHandshake } from '../types/realtime.types.js';

/**
 * Builds a handshake literal with the minimum every carrier lookup needs.
 * Overrides are kept loose on purpose: the spec exercises raw wire shapes
 * (numbers in headers, arrays in query, ...) the type system would reject.
 */
function buildHandshake(overrides: Record<string, unknown> = {}): WsHandshake {
  return {
    headers: {},
    auth: {},
    query: {},
    ...overrides,
  } as unknown as WsHandshake;
}

describe('extractToken', () => {
  it('reads the token from a Bearer authorization header', () => {
    const handshake = buildHandshake({
      headers: { authorization: 'Bearer header-token' },
    });

    expect(extractToken(handshake)).toBe('header-token');
  });

  it('reads the token from an authorization header sent as an array', () => {
    const handshake = buildHandshake({
      headers: { authorization: ['Bearer array-token'] },
    });

    expect(extractToken(handshake)).toBe('array-token');
  });

  it('trims whitespace around the bearer token', () => {
    const handshake = buildHandshake({
      headers: { authorization: 'Bearer   spaced-token  ' },
    });

    expect(extractToken(handshake)).toBe('spaced-token');
  });

  it('ignores a non-Bearer header and falls through to the auth payload', () => {
    const handshake = buildHandshake({
      headers: { authorization: 'Basic abc123' },
      auth: { token: 'auth-token' },
    });

    expect(extractToken(handshake)).toBe('auth-token');
  });

  it('falls through to auth when the bearer token is empty', () => {
    const handshake = buildHandshake({
      headers: { authorization: 'Bearer ' },
      auth: { token: 'auth-fallback' },
    });

    expect(extractToken(handshake)).toBe('auth-fallback');
  });

  it('falls through to the query token when header and auth are empty', () => {
    const handshake = buildHandshake({
      headers: { authorization: 'Bearer ' },
      query: { token: 'query-token' },
    });

    expect(extractToken(handshake)).toBe('query-token');
  });

  it('reads the auth token from an array value', () => {
    const handshake = buildHandshake({
      auth: { token: ['auth-array-token'] },
    });

    expect(extractToken(handshake)).toBe('auth-array-token');
  });

  it('ignores an empty auth token and uses the query token', () => {
    const handshake = buildHandshake({
      auth: { token: '' },
      query: { token: 'query-fallback' },
    });

    expect(extractToken(handshake)).toBe('query-fallback');
  });

  it('ignores a non-string auth token and falls through to query', () => {
    const handshake = buildHandshake({
      auth: { token: 123 },
      query: { token: 'query-token' },
    });

    expect(extractToken(handshake)).toBe('query-token');
  });

  it('reads the token from the query string', () => {
    const handshake = buildHandshake({
      query: { token: 'query-only-token' },
    });

    expect(extractToken(handshake)).toBe('query-only-token');
  });

  it('reads the query token from an array value', () => {
    const handshake = buildHandshake({
      query: { token: ['query-array-token'] },
    });

    expect(extractToken(handshake)).toBe('query-array-token');
  });

  it('returns null when a non-string header is the only carrier', () => {
    const handshake = buildHandshake({
      headers: { authorization: 42 },
    });

    expect(extractToken(handshake)).toBeNull();
  });

  it('returns null when every carrier is empty', () => {
    const handshake = buildHandshake({
      headers: { authorization: 'Bearer ' },
      auth: { token: '' },
      query: { token: '' },
    });

    expect(extractToken(handshake)).toBeNull();
  });

  it('returns null when the handshake carries nothing', () => {
    expect(extractToken(buildHandshake())).toBeNull();
  });
});

describe('resolveLang', () => {
  it('prefers the ?lang= query parameter', () => {
    const handshake = buildHandshake({
      query: { lang: 'ar' },
      headers: { 'x-lang': 'en' },
    });

    expect(resolveLang(handshake)).toBe('ar');
  });

  it('reads the lang query parameter from an array value', () => {
    const handshake = buildHandshake({
      query: { lang: ['ar'] },
    });

    expect(resolveLang(handshake)).toBe('ar');
  });

  it('falls through to x-lang when the ?lang= value is unsupported', () => {
    const handshake = buildHandshake({
      query: { lang: 'xx' },
      headers: { 'x-lang': 'ar' },
    });

    // An unsupported explicit value must not mask the next carrier.
    expect(resolveLang(handshake)).toBe('ar');
  });

  it('uses the x-lang header when the query lang is absent', () => {
    const handshake = buildHandshake({
      headers: { 'x-lang': 'ar', 'accept-language': 'fr-FR' },
    });

    expect(resolveLang(handshake)).toBe('ar');
  });

  it('falls back to the x-lang header when the query lang is not a string', () => {
    const handshake = buildHandshake({
      query: { lang: 42 },
      headers: { 'x-lang': 'en' },
    });

    expect(resolveLang(handshake)).toBe('en');
  });

  it('matches a supported primary subtag inside a full accept-language list', () => {
    const handshake = buildHandshake({
      headers: { 'accept-language': 'en-US,en;q=0.9,ar;q=0.8' },
    });

    expect(resolveLang(handshake)).toBe('en');
  });

  it('matches ar even when it is not the first entry', () => {
    const handshake = buildHandshake({
      headers: { 'accept-language': 'fr-FR,de;q=0.9,ar;q=0.8' },
    });

    expect(resolveLang(handshake)).toBe('ar');
  });

  it('scans an accept-language header sent as an array', () => {
    const handshake = buildHandshake({
      headers: { 'accept-language': ['fr;q=0.5, ar;q=0.9'] },
    });

    expect(resolveLang(handshake)).toBe('ar');
  });

  it('skips empty entries of the accept-language list', () => {
    const handshake = buildHandshake({
      headers: { 'accept-language': ',,en' },
    });

    expect(resolveLang(handshake)).toBe('en');
  });

  it('falls back to the default language when nothing is supported', () => {
    const handshake = buildHandshake({
      query: { lang: 'xx' },
      headers: { 'x-lang': 'yy', 'accept-language': 'fr-FR' },
    });

    expect(resolveLang(handshake)).toBe('en');
  });

  it('falls back to the default language on an empty handshake', () => {
    expect(resolveLang(buildHandshake())).toBe('en');
  });
});
