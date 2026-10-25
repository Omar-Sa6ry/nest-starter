import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: Number(configService.get<number>('DB_PORT', 5432)) || 5432,
          username:
            configService.get<string>('POSTGRES_USER') ||
            configService.get<string>('DB_USERNAME', 'postgres'),
          password:
            configService.get<string>('POSTGRES_PASSWORD') ||
            configService.get<string>('DB_PASSWORD', 'postgres'),
          database:
            configService.get<string>('DB_NAME', 'nest_starter_db'),

          autoLoadEntities: true,
          entities: [
            join(process.cwd(), 'dist/modules/**/{entity,entities}/*.entity.js'),
          ],
          
          logging: configService.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
          synchronize: !isProduction,
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
