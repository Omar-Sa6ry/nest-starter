import { Injectable } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const API_PREFIX = '/api';

/**
 * Accepts `/api/...` as an alias for every canonical route.
 *
 * Registered in `main.ts` BEFORE Nest routes the request, so:
 *   /api/health          -> /health
 *   /api/health/ready    -> /health/ready
 *   /api/metrics         -> /metrics
 *   /api/graphql         -> /graphql
 *   /api/auth/google     -> /auth/google
 *
 * Canonical (un-prefixed) paths keep working — they are the ones documented in
 * `api docs/`, used by nginx, the Docker healthchecks and Prometheus.
 * Only the routing URL is rewritten; `req.originalUrl` keeps the original value
 * for logging.
 */
@Injectable()
export class ApiAliasMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const path = req.path;

    if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
      const rewritten = req.url.replace(/^\/api(?=\/|\?|$)/, '');
      // '/api' alone rewrites to '' — keep it a valid path
      req.url = rewritten.startsWith('/') ? rewritten : `/${rewritten}`;
    }

    next();
  }
}
