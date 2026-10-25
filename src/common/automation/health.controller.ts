import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service.js';
import { DataSource } from 'typeorm';
import { RedisService } from '@bts-soft/core';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHealth(): {
    status: string;
    service: string;
    timestamp: string;
    system: ReturnType<HealthService['getSystemStats']>;
  } {
    return {
      status: 'UP',
      service: 'nest-starter',
      timestamp: new Date().toISOString(),
      system: this.healthService.getSystemStats(),
    };
  }

  @Get('ready')
  async getReadiness(@Res() res: Response): Promise<void> {
    const dbHealth = await this.healthService.checkDatabase(this.dataSource);
    const redisHealth = await this.healthService.checkRedis(this.redisService);
    const system = this.healthService.getSystemStats();

    const isHealthy = dbHealth.status === 'UP' && redisHealth.status === 'UP';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        redis: redisHealth,
      },
      system,
    });
  }
}
