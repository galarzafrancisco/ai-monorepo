import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import pg from 'pg';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

const usePglite = process.env.TEST_DB === 'pglite';

function runJest(databaseUrl, extraEnv = {}) {
  const jestArgs = [
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
    ...process.argv.slice(2),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [jestExecutable, ...jestArgs], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        TYPEORM_SCHEMA_MODE: 'migrate',
        ...extraEnv,
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Jest exited after signal ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

if (usePglite) {
  // In-process PostgreSQL (WASM) served over a local socket: no container needed.
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const dataDir = await mkdtemp(join(tmpdir(), 'taico-pglite-'));
  const db = await PGlite.create({
    dataDir,
    extensions: { vector, pg_trgm, pgcrypto },
  });
  const server = new PGLiteSocketServer({
    db,
    port: 0,
    host: '127.0.0.1',
    maxConnections: 50,
  });
  await server.start();
  const address = server.server?.address?.();
  const port = typeof address === 'object' && address ? address.port : 5433;
  try {
    process.exitCode = await runJest(
      `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
      // pglite-socket shares one backend session, so concurrent connections
      // interleave extended-protocol messages. A single pooled connection
      // keeps Parse/Bind/Execute sequences intact.
      { DATABASE_POOL_MAX: '1' },
    );
  } finally {
    await server.stop();
    await db.close();
    await rm(dataDir, { recursive: true, force: true });
  }
} else {
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
}
