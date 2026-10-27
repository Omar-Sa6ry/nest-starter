import { Injectable } from '@nestjs/common';
import type { IConnectionStore } from './interfaces/IConnectionStore.interface.js';


@Injectable()
export class InMemoryConnectionStore implements IConnectionStore {
  private readonly userToSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();
  private readonly socketHeartbeats = new Map<string, number>();

  async addSocket(userId: string, socketId: string): Promise<void> {
    let sockets = this.userToSockets.get(userId);
    if (!sockets) {
      sockets = new Set<string>();
      this.userToSockets.set(userId, sockets);
    }
    sockets.add(socketId);
    this.socketToUser.set(socketId, userId);
    this.socketHeartbeats.set(socketId, Date.now());
  }

  async removeSocket(socketId: string): Promise<string | null> {
    const userId = this.socketToUser.get(socketId) ?? null;
    this.socketToUser.delete(socketId);
    this.socketHeartbeats.delete(socketId);

    if (userId) {
      const sockets = this.userToSockets.get(userId);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.userToSockets.delete(userId);
        }
      }
    }
    return userId;
  }

  async getUserSockets(userId: string): Promise<string[]> {
    const sockets = this.userToSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  async getUserIdBySocketId(socketId: string): Promise<string | null> {
    return this.socketToUser.get(socketId) ?? null;
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = this.userToSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  async touchHeartbeat(socketId: string): Promise<void> {
    if (this.socketToUser.has(socketId)) {
      this.socketHeartbeats.set(socketId, Date.now());
    }
  }

  async findInactiveSockets(staleThresholdMs: number): Promise<string[]> {
    const now = Date.now();
    const staleSockets: string[] = [];
    for (const [socketId, lastHeartbeat] of this.socketHeartbeats.entries()) {
      if (now - lastHeartbeat > staleThresholdMs) {
        staleSockets.push(socketId);
      }
    }
    return staleSockets;
  }

  async getAllConnectedUsersCount(): Promise<number> {
    return this.userToSockets.size;
  }

  async getUserLastSeen(userId: string): Promise<number | null> {
    const sockets = this.userToSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      return null;
    }
    let latest = 0;
    for (const socketId of sockets) {
      const seen = this.socketHeartbeats.get(socketId);
      if (seen !== undefined && seen > latest) {
        latest = seen;
      }
    }
    return latest > 0 ? latest : null;
  }
}
