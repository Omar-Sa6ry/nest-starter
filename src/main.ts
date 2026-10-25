import * as bodyParser from 'body-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nValidationException } from 'nestjs-i18n';
import type { Request, Response, NextFunction } from 'express';
import { StructuredLogger } from './common/logging/logger.service.js';
import { ApiAliasMiddleware } from './common/middleware/api-alias.middleware.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger,
    abortOnError: false,
  });

  const configService = app.get(ConfigService);

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : false,
    credentials: true,
  });

  // Accept `/api/*` as an alias for every canonical route:
  //   /api/health -> /health, /api/metrics -> /metrics, /api/graphql -> /graphql ...
  // Must run before Nest routes the request (see ApiAliasMiddleware).
  const apiAlias = new ApiAliasMiddleware();
  app.use(
    (req: Request, res: Response, next: NextFunction) =>
      apiAlias.use(req, res, next),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        return new I18nValidationException(errors);
      },
    }),
  );

  app.use('/google/callback', bodyParser.raw({ type: 'application/json' }));

  const port = Number(configService.get<number>('PORT', 3000)) || 3000;
  await app.listen(port);

  logger.log(
    `Nest Starter application is running on: http://localhost:${port}/graphql`,
    'Bootstrap',
  );
  logger.log(
    `Metrics available at: http://localhost:${port}/metrics`,
    'Bootstrap',
  );
  logger.log(`Health check at: http://localhost:${port}/health`, 'Bootstrap');
}

process.on('uncaughtException', (err) => {
  console.error(
    '[process] Uncaught exception (continuing):',
    err?.message ?? err,
  );
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection (continuing):', reason);
});

bootstrap().catch((err) => {
  console.error('Bootstrap failed, retrying in 10s...', err.message);
  setTimeout(() => bootstrap(), 10000);
});
