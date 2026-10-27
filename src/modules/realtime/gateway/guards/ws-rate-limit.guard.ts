import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { SlidingWindowLogAlgorithm } from '@bts-soft/validation';
import {
  RATE_LIMIT,
  REALTIME_ENV,
  WS_DEFAULT_LANG,
} from '../../constants/realtime.constants.js';
import { WS_I18N } from '../../constants/realtime-i18n.constants.js';
import type { I18nTranslate } from '../../types/i18n.types.js';
import type { AuthenticatedSocket } from '../../types/realtime.types.js';
import { readPositiveInt } from '../../utils/read-positive-int.util.js';
import { wsError } from '../../utils/ws-errors.util.js';

@Injectable()
export class WsRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly limiter: SlidingWindowLogAlgorithm;

  constructor(
    config: ConfigService,
    @Inject(I18nService) private readonly i18n: I18nTranslate,
  ) {
    this.limiter = new SlidingWindowLogAlgorithm(
      readPositiveInt(config, REALTIME_ENV.RATE_LIMIT_MAX, RATE_LIMIT.DEFAULT_MAX),
      readPositiveInt(config, REALTIME_ENV.RATE_LIMIT_WINDOW_MS, RATE_LIMIT.DEFAULT_WINDOW_MS),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'ws') {
      return true;
    }
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const identifier = client.data?.user?.userId ?? client.handshake.address ?? 'anonymous';
    const result = await this.limiter.consume(identifier);
    if (result.allowed) {
      return true;
    }
    throw wsError(
      'RATE_LIMIT_EXCEEDED',
      this.i18n.t(WS_I18N.RATE_LIMIT_EXCEEDED, {
        lang: client.data?.lang ?? WS_DEFAULT_LANG,
      }) as string,
      429,
      { retryAfterSeconds: [String(result.retryAfterSeconds)] },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.limiter.destroy();
  }
}
