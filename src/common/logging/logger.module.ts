import { Module, MiddlewareConsumer, NestModule, Global } from '@nestjs/common';
import { StructuredLogger } from './logger.service.js';
import { LoggerMiddleware } from './middleware/logger.middleware.js';

@Global()
@Module({
  providers: [StructuredLogger],
  exports: [StructuredLogger],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
