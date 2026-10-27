import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class RealtimeMetricsService implements OnModuleInit {
  private readonly registry = client.register;

  public connectionsTotal!: client.Counter<string>;
  public connectionsActive!: client.Gauge<string>;
  public messagesTotal!: client.Counter<string>;
  public errorsTotal!: client.Counter<string>;
  public heartbeatsTotal!: client.Counter<string>;
  public staleConnectionsReapedTotal!: client.Counter<string>;
  public onlineUsersCount!: client.Gauge<string>;

  onModuleInit(): void {
    this.connectionsTotal =
      (this.registry.getSingleMetric(
        'ws_connections_total',
      ) as client.Counter<string>) ||
      new client.Counter({
        name: 'ws_connections_total',
        help: 'Total WebSocket connections',
        labelNames: ['outcome'],
        registers: [this.registry],
      });

    this.connectionsActive =
      (this.registry.getSingleMetric(
        'ws_connections_active',
      ) as client.Gauge<string>) ||
      new client.Gauge({
        name: 'ws_connections_active',
        help: 'Currently active WebSocket connections',
        labelNames: [],
        registers: [this.registry],
      });

    this.messagesTotal =
      (this.registry.getSingleMetric(
        'ws_messages_total',
      ) as client.Counter<string>) ||
      new client.Counter({
        name: 'ws_messages_total',
        help: 'Total WebSocket messages received',
        labelNames: ['event'],
        registers: [this.registry],
      });

    this.errorsTotal =
      (this.registry.getSingleMetric(
        'ws_errors_total',
      ) as client.Counter<string>) ||
      new client.Counter({
        name: 'ws_errors_total',
        help: 'Total WebSocket errors emitted to clients',
        labelNames: ['code'],
        registers: [this.registry],
      });

    this.heartbeatsTotal =
      (this.registry.getSingleMetric(
        'ws_heartbeats_total',
      ) as client.Counter<string>) ||
      new client.Counter({
        name: 'ws_heartbeats_total',
        help: 'Total WebSocket heartbeat pings processed',
        labelNames: [],
        registers: [this.registry],
      });

    this.staleConnectionsReapedTotal =
      (this.registry.getSingleMetric(
        'ws_stale_connections_reaped_total',
      ) as client.Counter<string>) ||
      new client.Counter({
        name: 'ws_stale_connections_reaped_total',
        help: 'Total stale WebSocket connections reaped by the heartbeat watchdog',
        labelNames: [],
        registers: [this.registry],
      });

    this.onlineUsersCount =
      (this.registry.getSingleMetric(
        'ws_online_users_count',
      ) as client.Gauge<string>) ||
      new client.Gauge({
        name: 'ws_online_users_count',
        help: 'Distinct online users with at least one live WebSocket connection',
        labelNames: [],
        registers: [this.registry],
      });
  }

  recordConnection(
    outcome: 'connected' | 'rejected_no_token' | 'rejected_invalid_token',
  ): void {
    this.connectionsTotal.inc({ outcome });
    if (outcome === 'connected') {
      this.connectionsActive.inc();
    }
  }

  recordDisconnection(): void {
    this.connectionsActive.dec();
  }

  recordMessage(event: string): void {
    this.messagesTotal.inc({ event });
  }

  recordError(code: string): void {
    this.errorsTotal.inc({ code });
  }

  recordHeartbeat(): void {
    this.heartbeatsTotal.inc();
  }

  recordReapedConnections(count: number): void {
    if (count > 0) {
      this.staleConnectionsReapedTotal.inc(count);
      this.connectionsActive.dec(count);
    }
  }

  setOnlineUsersCount(count: number): void {
    this.onlineUsersCount.set(count);
  }
}
