import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile =
  nodeEnv === 'production'
    ? 'environments/.env.production'
    : nodeEnv === 'staging'
      ? 'environments/.env.staging'
      : nodeEnv === 'test'
        ? 'environments/.env.test'
        : 'environments/.env.development';

config({ path: envFile });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.POSTGRES_USER || process.env.DB_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'nest_starter_db',
  entities: [join(process.cwd(), 'dist/modules/**/{entity,entities}/*.entity.js')],
  migrations: [join(process.cwd(), 'dist/migrations/*.js')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
});

