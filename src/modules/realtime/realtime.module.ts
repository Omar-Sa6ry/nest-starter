import { Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRedisClient } from '@bts-soft/cache';
import { RealtimeGateway } from './gateway/realtime.gateway.js';
import { RealtimeService } from './services/realtime.service.js';
import { ConnectionService } from './services/connection.service.js';
import { HeartbeatService } from './services/heartbeat.service.js';
import { RealtimeMetricsService } from './services/realtime-metrics.service.js';
import { WsAuthGuard } from './gateway/guards/ws-auth.guard.js';
import { WsRateLimitGuard } from './gateway/guards/ws-rate-limit.guard.js';
import { WsExceptionFilter } from './gateway/filters/ws-exception.filter.js';
import { WsResponseInterceptor } from './gateway/interceptors/ws-response.interceptor.js';
import { InMemoryConnectionStore } from './stores/in-memory-connection.store.js';
import { RedisConnectionStore } from './stores/redis-connection.store.js';
import {
  REALTIME_CONNECTION_STORE,
  type IConnectionStore,
} from './stores/interfaces/IConnectionStore.interface.js';
import { createRealtimeClusterAdapter } from './adapters/redis-cluster.adapter.js';
import { REALTIME_ENV } from './constants/realtime.constants.js';

@Module({
  providers: [
    RealtimeGateway,
    RealtimeService,
    ConnectionService,
    HeartbeatService,
    RealtimeMetricsService,
    WsAuthGuard,
    WsRateLimitGuard,
    WsExceptionFilter,
    WsResponseInterceptor,
    InMemoryConnectionStore,
    RedisConnectionStore,
    {
      provide: REALTIME_CONNECTION_STORE,
      useFactory: (
        config: ConfigService,
        memory: InMemoryConnectionStore,
        redis: RedisConnectionStore,
      ): IConnectionStore => {
        const cluster = config.get<string>(REALTIME_ENV.CLUSTER) === 'true';
        const store = config.get<string>(REALTIME_ENV.STORE) ?? 'memory';
        return cluster || store === 'redis' ? redis : memory;
      },
      inject: [ConfigService, InMemoryConnectionStore, RedisConnectionStore],
    },
  ],
  exports: [RealtimeService, ConnectionService, RealtimeMetricsService],
})

export class RealtimeModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeModule.name);
  private detachClusterAdapter: (() => Promise<void>) | null = null;

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>(REALTIME_ENV.CLUSTER) !== 'true') {
      return;
    }
    
    if (!this.gateway.server) {
      this.logger.warn('Cluster requested but no socket server was attached, skipping adapter');
      return;
    }

    try {
      this.detachClusterAdapter = await createRealtimeClusterAdapter(
        createRedisClient,
        this.logger,
      )(this.gateway.server);
    } catch (error) {
      this.logger.error(
        `Cluster adapter unavailable, continuing node-local: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.detachClusterAdapter) {
      await this.detachClusterAdapter();
      this.detachClusterAdapter = null;
    }
  }
}
