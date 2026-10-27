import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Server } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import {
  REALTIME_CONNECTION_STORE,
  type IConnectionStore,
} from '../stores/interfaces/IConnectionStore.interface.js';
import { HEARTBEAT, REALTIME_ENV } from '../constants/realtime.constants.js';
import { readPositiveInt } from '../utils/read-positive-int.util.js';
import { RealtimeMetricsService } from './realtime-metrics.service.js';

@Injectable()
export class HeartbeatService implements OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);
  private timer: NodeJS.Timeout | null = null;
  private server: Server | null = null;

  private readonly staleThresholdMs: number;
  private readonly sweepIntervalMs: number;

  constructor(
    @Inject(REALTIME_CONNECTION_STORE)
    private readonly store: IConnectionStore,
    config: ConfigService,
    private readonly metrics: RealtimeMetricsService,
  ) {
    this.staleThresholdMs = readPositiveInt(
      config,
      REALTIME_ENV.HEARTBEAT_STALE_MS,
      HEARTBEAT.STALE_MS,
    );
    this.sweepIntervalMs = Math.min(
      readPositiveInt(config, REALTIME_ENV.HEARTBEAT_SWEEP_MS, HEARTBEAT.SWEEP_INTERVAL_MS),
      this.staleThresholdMs,
    );
  }

  onModuleDestroy(): void {
    this.stopWatchdog();
  }

  bindServer(server: Server): void {
    this.server = server;
    this.startWatchdog();
  }

  startWatchdog(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.cleanStaleConnections();
    }, this.sweepIntervalMs);
    // Unref so test suites or graceful shutdowns aren't blocked by the timer.
    this.timer.unref?.();
  }

  stopWatchdog(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async cleanStaleConnections(): Promise<number> {
    const staleSockets = await this.store.findInactiveSockets(this.staleThresholdMs);
    if (staleSockets.length === 0) {
      return 0;
    }

    this.logger.warn(`Cleaning up ${staleSockets.length} zombie/stale websocket connections`);

    for (const socketId of staleSockets) {
      await this.store.removeSocket(socketId);
      this.server?.sockets.sockets.get(socketId)?.disconnect(true);
    }

    this.metrics.recordReapedConnections(staleSockets.length);

    return staleSockets.length;
  }
}
