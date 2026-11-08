import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
