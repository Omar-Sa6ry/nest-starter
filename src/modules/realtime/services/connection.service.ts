import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REALTIME_CONNECTION_STORE,
  type IConnectionStore,
} from '../stores/interfaces/IConnectionStore.interface.js';
import type { UserPresenceStatus } from '../types/realtime.types.js';

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  constructor(
    @Inject(REALTIME_CONNECTION_STORE)
    private readonly store: IConnectionStore,
  ) {}

  async onConnect(userId: string, socketId: string): Promise<void> {
    await this.store.addSocket(userId, socketId);
    this.logger.log(`Socket connected: ${socketId} for user: ${userId}`);
  }

  async onDisconnect(socketId: string): Promise<string | null> {
    const userId = await this.store.removeSocket(socketId);
    this.logger.log(`Socket disconnected: ${socketId} (user: ${userId ?? 'unknown'})`);
    return userId;
  }

  async getUserSockets(userId: string): Promise<string[]> {
    return this.store.getUserSockets(userId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.store.isUserOnline(userId);
  }

  async getUserPresence(userId: string): Promise<UserPresenceStatus> {
    const sockets = await this.store.getUserSockets(userId);
    const lastSeenMs = await this.store.getUserLastSeen(userId);
    return {
      userId,
      isOnline: sockets.length > 0,
      connectionsCount: sockets.length,
      lastSeenAt: lastSeenMs === null ? null : new Date(lastSeenMs),
    };
  }

  async recordHeartbeat(socketId: string): Promise<void> {
    await this.store.touchHeartbeat(socketId);
  }

  async getConnectedUsersCount(): Promise<number> {
    return this.store.getAllConnectedUsersCount();
  }
}
