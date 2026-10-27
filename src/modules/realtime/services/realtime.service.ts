import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from '../gateway/realtime.gateway.js';
import { ConnectionService } from './connection.service.js';
import { createWsEnvelope } from '../utils/ws-envelope.util.js';
import { userRoom } from '../constants/realtime.constants.js';
import type { UserPresenceStatus, WsEnvelope } from '../types/realtime.types.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly connectionService: ConnectionService,
  ) {}

  async emitToUser<T = unknown>(userId: string, event: string, data: T): Promise<boolean> {
    if (!(await this.connectionService.isUserOnline(userId))) {
      this.logger.debug(`User ${userId} is offline, skipping realtime delivery`);
      return false;
    }

    const envelope: WsEnvelope<T> = createWsEnvelope(event, data);
    this.gateway.server.to(userRoom(userId)).emit(event, envelope);
    return true;
  }

  async emitToUsers<T = unknown>(
    userIds: readonly string[],
    event: string,
    data: T,
  ): Promise<void> {
    await Promise.all(userIds.map((userId) => this.emitToUser(userId, event, data)));
  }

  emitToRoom<T = unknown>(room: string, event: string, data: T): void {
    this.gateway.server.to(room).emit(event, createWsEnvelope(event, data));
  }

  broadcast<T = unknown>(event: string, data: T): void {
    this.gateway.server.emit(event, createWsEnvelope(event, data));
  }

  async getUserPresence(userId: string): Promise<UserPresenceStatus> {
    return this.connectionService.getUserPresence(userId);
  }

  async getOnlineUsersCount(): Promise<number> {
    return this.connectionService.getConnectedUsersCount();
  }
}
