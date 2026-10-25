import { join } from 'path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import {
  RedisModule,
  TranslationModule,
} from '@bts-soft/core';
import { Response } from 'express';
import {
  SESSION_STORE,
  PASSWORD_HASHER,
  TOKEN_PROVIDER,
} from './security/tokens/injection.tokens.js';
import { DatabaseModule } from './database/database.module.js';
import { BcryptPasswordHasher } from './security/bcrypt-password.hasher.js';
import { JwtTokenProvider } from './security/jwt-token.provider.js';
import { RedisSessionRepository } from './database/repositories/redis-session.repository.js';
import { IAuthenticatedRequest, IGraphQLContext } from './interfaces/IContext.interface.js';
import { formatGraphQLError } from './graphql/graphql-error.formatter.js';

const nodeEnv = process.env.NODE_ENV;
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';

const envFilePath = isProduction
  ? 'environments/.env.production'
  : isStaging
    ? 'environments/.env.staging'
    : nodeEnv === 'test'
      ? 'environments/.env.test'
      : 'environments/.env.development';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
    }),

    TranslationModule.forRoot({
      fallbackLanguage: 'en',
      localesPath: join(process.cwd(), 'src/common/translation/locales'),
      watch: true,
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')) || 6379,
        },
      }),
    }),
    EventEmitterModule.forRoot(),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: '/graphql',
      autoSchemaFile:
        isProduction || isStaging
          ? true
          : join(process.cwd(), 'src/schema.gql'),
      // Every error — resolver (GraphQLExceptionFilter), parse/validation and
      // HTTP-layer — is flattened to { message, success, statusCode, timestamp }.
      // No locations / path / extensions / stacktrace in responses.
      formatError: formatGraphQLError,
      context: ({
        req,
        res,
      }: {
        req: IAuthenticatedRequest;
        res: Response;
      }): IGraphQLContext => ({
        req,
        res,
        user: req?.user,
        language:
          (req?.headers?.['accept-language'] as string) ||
          (req?.headers?.['x-lang'] as string) ||
          'en',
      }),
      playground: !isProduction,
      introspection: !isProduction,
    }),

    RedisModule,
    DatabaseModule,
  ],
  providers: [
    BcryptPasswordHasher,
    JwtTokenProvider,
    RedisSessionRepository,
    { provide: PASSWORD_HASHER, useExisting: BcryptPasswordHasher },
    { provide: TOKEN_PROVIDER, useExisting: JwtTokenProvider },
    { provide: SESSION_STORE, useExisting: RedisSessionRepository },
  ],
  exports: [
    ConfigModule,
    RedisModule,
    PASSWORD_HASHER,
    TOKEN_PROVIDER,
    SESSION_STORE,
  ],
})
export class CommonModule {}
