import { Injectable } from '@nestjs/common';
import { RedisService } from '@bts-soft/core';
import {
  ISessionStore,
  IUserSessionData,
} from '../../interfaces/ISecurity.interface.js';

@Injectable()
export class RedisSessionRepository implements ISessionStore {
  constructor(private readonly redisService: RedisService) {}

  private sessionKey(userId: string, sessionId: string): string {
    return `user:session:${userId}:${sessionId}`;
  }

  private refreshKey(refreshTokenHash: string): string {
    return `user:refresh:${refreshTokenHash}`;
  }

  private blacklistKey(jti: string): string {
    return `token:blacklist:${jti}`;
  }

  async createSession(
    userId: string,
    sessionId: string,
    data: IUserSessionData,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.sessionKey(userId, sessionId);
    await this.redisService.set(key, data, ttlSeconds);
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<IUserSessionData | null> {
    const key = this.sessionKey(userId, sessionId);
    const data = await this.redisService.get<IUserSessionData>(key);
    return data ?? null;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const key = this.sessionKey(userId, sessionId);
    await this.redisService.del(key);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const pattern = `user:session:${userId}:*`;
    await this.redisService.delByPattern(pattern);
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    const key = this.blacklistKey(jti);
    await this.redisService.set(key, { blacklisted: true }, ttlSeconds);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const key = this.blacklistKey(jti);
    const data = await this.redisService.get<{ blacklisted: boolean }>(key);
    return data?.blacklisted === true;
  }

  async storeRefreshToken(
    refreshTokenHash: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.refreshKey(refreshTokenHash);
    await this.redisService.set(key, { userId }, ttlSeconds);
  }

  async getUserIdByRefreshToken(
    refreshTokenHash: string,
  ): Promise<string | null> {
    const key = this.refreshKey(refreshTokenHash);
    const data = await this.redisService.get<{ userId?: string }>(key);
    return data?.userId ?? null;
  }

  async revokeRefreshToken(refreshTokenHash: string): Promise<void> {
    const key = this.refreshKey(refreshTokenHash);
    await this.redisService.del(key);
  }
}
