import { Injectable } from '@nestjs/common';
import { RedisService } from '@bts-soft/core';
import { IRedisAdapter } from '../interfaces/IAuth.interface.js';

@Injectable()
export class RedisAdapter implements IRedisAdapter {
  constructor(private readonly redis: RedisService) {}

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    await this.redis.set(key, value, ttl);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.redis.get<T>(key);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export const REDIS_ADAPTER = 'REDIS_ADAPTER';