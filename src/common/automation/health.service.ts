import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '@bts-soft/core';
import { StructuredLogger } from '../logging/logger.service.js';
import { IHealthCheckResult } from './interface/IHealthCheckResult.interface.js';

function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function extractErrorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

@Injectable()
export class HealthService {
  private readonly logger = new StructuredLogger();

  async checkDatabase(dataSource: DataSource): Promise<IHealthCheckResult> {
    try {
      await dataSource.query('SELECT 1');
      return { status: 'UP' };
    } catch (err: unknown) {
      this.logger.error(
        'Health Check: Database connection failed',
        extractErrorStack(err),
        'HealthService',
      );
      return {
        status: 'DOWN',
        message: extractErrorMessage(err) || 'Database error',
      };
    }
  }

  async checkRedis(redisService: RedisService): Promise<IHealthCheckResult> {
    try {
      await redisService.ttl('health:probe');
      return { status: 'UP' };
    } catch (err: unknown) {
      this.logger.error(
        'Health Check: Redis connection failed',
        extractErrorStack(err),
        'HealthService',
      );
      return {
        status: 'DOWN',
        message: extractErrorMessage(err) || 'Redis error',
      };
    }
  }

  getSystemStats() {
    const memoryUsage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memory: {
        heapTotalMemoryMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedMemoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      cpuUsage: process.cpuUsage(),
    };
  }
}
