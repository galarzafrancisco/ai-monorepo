import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import lockfile from 'proper-lockfile';
import {
  credentialsKey,
  readWorkerCredentials,
  writeWorkerCredentials,
} from '../auth/credentials-store.js';
import type { WorkerCredentials } from '../auth/worker-auth.types.js';

function credentials(overrides: Partial<WorkerCredentials>): WorkerCredentials {
  return {
    serverUrl: 'http://localhost:2008',
    clientId: 'client',
    redirectUri: 'http://127.0.0.1:1/callback',
    scope: 'workers:connect',
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: new Date(0).toISOString(),
    ...overrides,
  };
}

test('a worker without --workspace keeps the server URL as its key', () => {
  assert.equal(credentialsKey('http://localhost:2008/'), 'http://localhost:2008');
  assert.equal(
    credentialsKey('http://localhost:2008/', 'acme'),
    'http://localhost:2008#workspace=acme',
  );
});

test('workers of different workspaces on one server keep their own credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-credentials-'));
  const path = join(dir, 'credentials.json');
  try {
    await writeWorkerCredentials(path, credentials({ clientId: 'plain' }));
    await writeWorkerCredentials(path, credentials({ clientId: 'acme', workspace: 'acme' }));
    await writeWorkerCredentials(path, credentials({ clientId: 'beta', workspace: 'beta' }));

    const server = 'http://localhost:2008';
    assert.equal((await readWorkerCredentials(path, server))?.clientId, 'plain');
    assert.equal((await readWorkerCredentials(path, server, 'acme'))?.clientId, 'acme');
    assert.equal((await readWorkerCredentials(path, server, 'beta'))?.clientId, 'beta');
    assert.equal(await readWorkerCredentials(path, server, 'gamma'), null);

    const stored = JSON.parse(readFileSync(path, 'utf8')) as { servers: object };
    assert.deepEqual(Object.keys(stored.servers).sort(), [
      'http://localhost:2008',
      'http://localhost:2008#workspace=acme',
      'http://localhost:2008#workspace=beta',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workers writing at the same time keep each other\'s credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-credentials-'));
  const path = join(dir, 'credentials.json');
  try {
    const workspaces = Array.from({ length: 8 }, (_, i) => `ws-${i}`);
    await Promise.all(
      workspaces.map((workspace) =>
        writeWorkerCredentials(path, credentials({ clientId: workspace, workspace })),
      ),
    );

    const server = 'http://localhost:2008';
    for (const workspace of workspaces) {
      assert.equal(
        (await readWorkerCredentials(path, server, workspace))?.clientId,
        workspace,
      );
    }
    // Only the credentials file is left: no lock, no temporary files.
    assert.deepEqual(readdirSync(dir), ['credentials.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const writerScript = fileURLToPath(new URL('./fixtures/write-credentials.ts', import.meta.url));

test('separate worker processes writing at the same time keep each other\'s credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-credentials-'));
  const path = join(dir, 'credentials.json');
  try {
    const workspaces = Array.from({ length: 6 }, (_, i) => `proc-${i}`);
    await Promise.all(
      workspaces.map((workspace) =>
        promisify(execFile)(process.execPath, ['--import', 'tsx', writerScript, path, workspace]),
      ),
    );

    for (const workspace of workspaces) {
      assert.equal(
        (await readWorkerCredentials(path, 'http://localhost:2008', workspace))?.clientId,
        workspace,
      );
    }
    assert.deepEqual(readdirSync(dir), ['credentials.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a lock left by a worker that died is taken over', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-credentials-'));
  const path = join(dir, 'credentials.json');
  try {
    // proper-lockfile's lock is a directory; one untouched for a minute is stale.
    mkdirSync(`${path}.lock`);
    const old = new Date(Date.now() - 60_000);
    utimesSync(`${path}.lock`, old, old);

    await writeWorkerCredentials(path, credentials({ clientId: 'acme', workspace: 'acme' }));

    assert.equal(
      (await readWorkerCredentials(path, 'http://localhost:2008', 'acme'))?.clientId,
      'acme',
    );
    assert.deepEqual(readdirSync(dir), ['credentials.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a lock held by a live worker is waited for, not taken over', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-credentials-'));
  const path = join(dir, 'credentials.json');
  try {
    const release = await lockfile.lock(path, { realpath: false, stale: 10_000 });
    const write = writeWorkerCredentials(path, credentials({ clientId: 'acme', workspace: 'acme' }));

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(existsSync(path), false, 'wrote while another worker held the lock');
    assert.equal(lockfile.checkSync(path, { realpath: false }), true);

    await release();
    await write;
    assert.equal(
      (await readWorkerCredentials(path, 'http://localhost:2008', 'acme'))?.clientId,
      'acme',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed write leaves no temporary file or lock behind', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-credentials-'));
  const path = join(dir, 'credentials.json');
  try {
    // A non-empty directory where the file should be makes the rename fail.
    mkdirSync(path);
    writeFileSync(join(path, 'keep'), '');

    await assert.rejects(
      writeWorkerCredentials(path, credentials({ clientId: 'acme', workspace: 'acme' })),
    );
    assert.deepEqual(readdirSync(dir), ['credentials.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
