import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const require = createRequire(import.meta.url);
const jestExecutable = require.resolve('jest/bin/jest');
const adminUrl = new URL(
  process.env.POSTGRES_ADMIN_URL ??
    'postgresql://taico:taico@127.0.0.1:5432/postgres',
);
const databaseName = `taico_test_${process.pid}_${randomBytes(5).toString('hex')}`;

if (!/^taico_test_[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error(
    'Refusing to manage a database without the taico_test_ prefix',
  );
}

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${databaseName}`;

  const jestArgs = [
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
    ...process.argv.slice(2),
  ];
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [jestExecutable, ...jestArgs], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: testUrl.toString(),
        TYPEORM_SCHEMA_MODE: 'migrate',
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Jest exited after signal ${signal}`));
      else resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
} finally {
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
    [databaseName],
  );
  await admin.query(`DROP DATABASE "${databaseName}"`);
  await admin.end();
}
