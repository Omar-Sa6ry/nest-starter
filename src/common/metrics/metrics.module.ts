import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import { MetricsInterceptor } from './interceptor/metrics.interceptor.js';
import { MetricsController } from './metrics.controller.js';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsInterceptor],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
