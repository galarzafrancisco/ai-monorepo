import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';

import { createAuthorizationServer, createPublicClient } from '@taico/authorization-server';
import { sqliteStorage } from '@taico/authorization-server/storage/sqlite';

test('authorization requests cannot escalate beyond configured client scopes', async () => {
  const storage = await sqliteStorage({ file: join(tmpdir(), `taico-auth-scope-${crypto.randomUUID()}.sqlite`) });
  const auth = await createAuthorizationServer({
    issuer: 'http://127.0.0.1:0',
    storage,
    identityProvider: {},
    scopes: [{ id: 'mcp:use' }, { id: 'tasks:write' }],
  });
  const client = createPublicClient({
    name: 'Smoke test client',
    redirectUris: ['http://localhost/callback'],
    scopes: ['mcp:use'],
  });
  await storage.saveClient(client);

  const app = express();
  app.use('/auth', auth.express().routes());
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const response = await fetch(new URL(`/auth/authorize?client_id=${client.id}&redirect_uri=${encodeURIComponent('http://localhost/callback')}&response_type=code&scope=tasks:write&code_challenge=abc&code_challenge_method=S256`, `http://127.0.0.1:${address.port}`));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_scope');

    const metadata = await auth.discovery.authorizationServerMetadata();
    assert.deepEqual(metadata.grant_types_supported, ['authorization_code', 'password']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
