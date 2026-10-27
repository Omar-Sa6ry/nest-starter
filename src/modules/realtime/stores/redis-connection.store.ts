import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@bts-soft/cache';
import { HEARTBEAT, RT_REDIS_KEYS } from '../constants/realtime.constants.js';
import type { IConnectionStore } from './interfaces/IConnectionStore.interface.js';

@Injectable()
export class RedisConnectionStore implements IConnectionStore {
  private readonly logger = new Logger(RedisConnectionStore.name);
  private readonly ttlSeconds = HEARTBEAT.REDIS_TTL_SECONDS;

  constructor(private readonly redis: RedisService) {}

  async addSocket(userId: string, socketId: string): Promise<void> {
    try {
      // HASH: socketId → { userId, connectedAt }
      await this.redis.hSet(RT_REDIS_KEYS.socketUser(socketId), 'userId', userId);
      await this.redis.hSet(
        RT_REDIS_KEYS.socketUser(socketId),
        'connectedAt',
        new Date().toISOString(),
      );
      await this.redis.expire(RT_REDIS_KEYS.socketUser(socketId), this.ttlSeconds);

      // SET: user's sockets
      await this.redis.sAdd(RT_REDIS_KEYS.userSockets(userId), socketId);
      await this.redis.expire(RT_REDIS_KEYS.userSockets(userId), this.ttlSeconds);

      // SET: global online users
      await this.redis.sAdd(RT_REDIS_KEYS.ONLINE_USERS, userId);

      // ZSET: heartbeat (score = epoch ms)
      await this.redis.zAdd(HEARTBEAT.NAME, Date.now(), socketId);
    } catch (error) {
      this.logger.error(`Failed to register socket ${socketId} for user ${userId}`, error);
    }
  }

  async removeSocket(socketId: string): Promise<string | null> {
    try {
      const userId = await this.resolveSocketOwner(socketId);

      // Remove the HASH for this socket
      await this.redis.del(RT_REDIS_KEYS.socketUser(socketId));
      // Remove from the ZSET heartbeat tracker
      await this.redis.zRem(HEARTBEAT.NAME, socketId);

      if (!userId) {
        return null;
      }

      // Remove from user's SET of sockets
      await this.redis.sRem(RT_REDIS_KEYS.userSockets(userId), socketId);

      // If the user has no remaining sockets, remove from the online SET
      const remaining = await this.redis.sCard(RT_REDIS_KEYS.userSockets(userId));
      if (remaining === 0) {
        await this.redis.sRem(RT_REDIS_KEYS.ONLINE_USERS, userId);
        await this.redis.del(RT_REDIS_KEYS.userSockets(userId));
      }
      return userId;
    } catch (error) {
      this.logger.error(`Failed to remove socket ${socketId}`, error);
      return null;
    }
  }

  async getUserSockets(userId: string): Promise<string[]> {
    try {
      return await this.redis.sMembers(RT_REDIS_KEYS.userSockets(userId));
    } catch (error) {
      this.logger.error(`Failed to list sockets for user ${userId}`, error);
      return [];
    }
  }

  async getUserIdBySocketId(socketId: string): Promise<string | null> {
    try {
      return await this.resolveSocketOwner(socketId);
    } catch (error) {
      this.logger.error(`Failed to resolve owner of socket ${socketId}`, error);
      return null;
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      return await this.redis.sIsMember(RT_REDIS_KEYS.ONLINE_USERS, userId);
    } catch (error) {
      this.logger.error(`Failed to read presence of user ${userId}`, error);
      return false;
    }
  }

  async touchHeartbeat(socketId: string): Promise<void> {
    try {
      await this.redis.zAdd(HEARTBEAT.NAME, Date.now(), socketId);
    } catch (error) {
      this.logger.warn(`Failed to touch heartbeat for socket ${socketId}`, error);
    }
  }

  async findInactiveSockets(staleThresholdMs: number): Promise<string[]> {
    try {
      const cutoff = Date.now() - staleThresholdMs;
      // Everything scored at or below `cutoff` has not pinged within the threshold.
      return await this.redis.zRangeByScore(HEARTBEAT.NAME, 0, cutoff);
    } catch (error) {
      this.logger.error('Failed to query inactive sockets from Redis', error);
      return [];
    }
  }

  async getAllConnectedUsersCount(): Promise<number> {
    try {
      return await this.redis.sCard(RT_REDIS_KEYS.ONLINE_USERS);
    } catch (error) {
      this.logger.error('Failed to count online users', error);
      return 0;
    }
  }

  async getUserLastSeen(userId: string): Promise<number | null> {
    try {
      const sockets = await this.getUserSockets(userId);
      if (sockets.length === 0) return null;

      let latest = 0;
      for (const socketId of sockets) {
        const seen = await this.redis.zScore(HEARTBEAT.NAME, socketId);
        if (Number.isFinite(seen) && seen > latest) {
          latest = seen;
        }
      }
      return latest > 0 ? latest : null;
    } catch (error) {
      this.logger.error(`Failed to read last seen of user ${userId}`, error);
      return null;
    }
  }

  private async resolveSocketOwner(socketId: string): Promise<string | null> {
    const userId = await this.redis.hGet<string>(RT_REDIS_KEYS.socketUser(socketId), 'userId');
    if (!userId || userId.trim().length === 0) {
      return null;
    }
    return userId.trim();
  }
}
