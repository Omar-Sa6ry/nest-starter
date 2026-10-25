import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { I18nService } from 'nestjs-i18n';
import { ResponseFormatter } from './response-formatter.js';

interface GraphQLFormattedPayload {
  statusCode?: number;
  success?: boolean;
}

@Injectable()
export class GraphQLResponseInterceptor implements NestInterceptor {
  constructor(
    @Optional() private readonly i18n?: I18nService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isGraphQL = context.getType<string>() === 'graphql';

    return next.handle().pipe(
      map((data: unknown) => {
        if (!isGraphQL) return data;

        const candidate = data as GraphQLFormattedPayload | undefined;
        if (
          candidate &&
          candidate.statusCode !== undefined &&
          candidate.success !== undefined
        ) {
          return data;
        }

        return ResponseFormatter.formatSuccess(
          data,
          this.i18n?.t('common.OPERATION_SUCCESS') ??
            'Operation executed successfully',
        );
      }),
    );
  }
}
