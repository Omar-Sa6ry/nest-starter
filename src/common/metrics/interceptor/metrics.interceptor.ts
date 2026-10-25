import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import { MetricsService } from '../metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept<T>(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T> {
    const startTime = process.hrtime();
    const type = context.getType<string>();

    let protocol = 'HTTP';
    let method = 'GET';
    let path = '/';

    if (type === 'http') {
      const req = context.switchToHttp().getRequest();
      protocol = 'HTTP';
      method = req.method;
      path = req.baseUrl + req.path;
    } else if (type === 'graphql') {
      try {
        const gqlContext = GqlExecutionContext.create(context);
        const info = gqlContext.getInfo();
        protocol = 'GraphQL';
        method = info.operation?.operation?.toUpperCase() || 'QUERY';
        path = info.fieldName;
      } catch {
        protocol = 'GraphQL';
        method = 'UNKNOWN';
        path = 'GraphQLResolver';
      }
    } else if (type === 'rpc') {
      protocol = 'gRPC';
      method = 'RPC';
      path = context.getHandler().name;
    }

    return next.handle().pipe(
      tap(() => {
        const diff = process.hrtime(startTime);
        const durationSeconds = diff[0] + diff[1] / 1e9;

        let statusCode = '200';
        if (type === 'http') {
          const res = context.switchToHttp().getResponse();
          statusCode = res.statusCode?.toString() || '200';
        }

        this.metricsService.requestCounter.inc({
          protocol,
          method,
          path,
          statusCode,
        });
        this.metricsService.requestDuration.observe(
          { protocol, method, path, statusCode },
          durationSeconds,
        );
      }),
      catchError((error: unknown) => {
        const diff = process.hrtime(startTime);
        const durationSeconds = diff[0] + diff[1] / 1e9;

        const errObj = (error ?? {}) as {
          status?: string | number;
          statusCode?: string | number;
          code?: string;
          name?: string;
        };

        let statusCode = '500';
        if (type === 'http') {
          statusCode = String(errObj.status ?? errObj.statusCode ?? '500');
        }

        this.metricsService.requestCounter.inc({
          protocol,
          method,
          path,
          statusCode,
        });
        this.metricsService.requestDuration.observe(
          { protocol, method, path, statusCode },
          durationSeconds,
        );

        const errorCode = errObj.code ?? errObj.name ?? 'UNKNOWN_ERROR';
        this.metricsService.errorCounter.inc({
          context: `${protocol}:${path}`,
          errorCode,
        });

        return throwError(() => error);
      }),
    );
  }
}
