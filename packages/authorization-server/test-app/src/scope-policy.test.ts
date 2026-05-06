import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';

import { createAuthorizationServer, createPublicClient, type AuthorizationCode } from '@taico/authorization-server';
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
    assert.equal(metadata.issuer, 'http://127.0.0.1:0/auth');
    assert.equal(metadata.authorization_endpoint, 'http://127.0.0.1:0/auth/authorize');
    assert.deepEqual(metadata.grant_types_supported, ['authorization_code', 'password']);

    const resourceMetadata = await auth.discovery.protectedResourceMetadata('http://localhost/resource');
    assert.deepEqual(resourceMetadata.authorization_servers, ['http://127.0.0.1:0/auth']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('authorization code consumption is atomic and single use', async () => {
  const storage = await sqliteStorage({ file: join(tmpdir(), `taico-auth-code-${crypto.randomUUID()}.sqlite`) });
  const code: AuthorizationCode = {
    code: crypto.randomUUID(),
    clientId: 'client-1',
    redirectUri: 'http://localhost/callback',
    subject: 'user-1',
    scopes: ['mcp:use'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  await storage.saveAuthorizationCode(code);

  const results = await Promise.all([
    storage.consumeAuthorizationCode(code.code),
    storage.consumeAuthorizationCode(code.code),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await storage.consumeAuthorizationCode(code.code), null);
});
