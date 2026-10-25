import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ApiAliasMiddleware } from './api-alias.middleware.js';

type MockRequest = Partial<Pick<Request, 'path' | 'url'>>;

function run(url: string, path?: string) {
  const req = {
    url,
    path: path ?? url.split('?')[0],
  } as MockRequest;
  const next = vi.fn();
  const middleware = new ApiAliasMiddleware();

  middleware.use(req as Request, {} as Response, next as NextFunction);

  return { req, next };
}

describe('ApiAliasMiddleware', () => {
  it('strips the /api prefix from /api/health', () => {
    const { req, next } = run('/api/health');

    expect(req.url).toBe('/health');
    expect(next).toHaveBeenCalledOnce();
  });

  it('strips the /api prefix from nested paths', () => {
    const { req } = run('/api/health/ready');

    expect(req.url).toBe('/health/ready');
  });

  it('keeps the query string', () => {
    const { req } = run('/api/metrics?format=prom');

    expect(req.url).toBe('/metrics?format=prom');
  });

  it('keeps the query string when the path is exactly /api', () => {
    const { req } = run('/api?x=1');

    expect(req.url).toBe('/?x=1');
  });

  it('rewrites a bare /api to /', () => {
    const { req } = run('/api');

    expect(req.url).toBe('/');
  });

  it('leaves canonical paths untouched', () => {
    const { req } = run('/health/ready');

    expect(req.url).toBe('/health/ready');
  });

  it('does not touch paths that merely start with "api"', () => {
    const { req } = run('/apiary');

    expect(req.url).toBe('/apiary');
  });

  it('does not rewrite /apiary-thing either', () => {
    const { req } = run('/apiary-thing');

    expect(req.url).toBe('/apiary-thing');
  });

  it('always calls next()', () => {
    const { next } = run('/graphql');

    expect(next).toHaveBeenCalledTimes(1);
  });
});
