import 'reflect-metadata';
import { DataSource } from 'typeorm';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for TypeORM CLI commands');
}

export default new DataSource({
  type: 'postgres',
  url: connectionString,
  uuidExtension: 'pgcrypto',
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});
