import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';

import { createAuthorizationServer, createPublicClient, type AuthorizationCode } from '@taico/authorization-server';
import { sqliteStorage } from '@taico/authorization-server/storage/sqlite';

test('authorization requests cannot escalate beyond configured client scopes', async () => {
  const storage = await sqliteStorage({ file: join(tmpdir(), `taico-auth-scope-${crypto.randomUUID()}.sqlite`) });
  const app = express();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const auth = await createAuthorizationServer({
    issuer: origin,
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
  app.use(auth.express().routes());

  try {
    const response = await fetch(new URL(`/auth/authorize?client_id=${client.id}&redirect_uri=${encodeURIComponent('http://localhost/callback')}&response_type=code&scope=tasks:write&code_challenge=abc&code_challenge_method=S256`, origin));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_scope');

    const metadata = await auth.discovery.authorizationServerMetadata();
    assert.equal(metadata.issuer, `${origin}/auth`);
    assert.equal(metadata.authorization_endpoint, `${origin}/auth/authorize`);
    assert.deepEqual(metadata.grant_types_supported, ['authorization_code', 'password']);

    const resourceMetadata = await auth.discovery.protectedResourceMetadata('http://localhost/resource');
    assert.deepEqual(resourceMetadata.authorization_servers, [`${origin}/auth`]);

    const discoveredIssuer = new URL(resourceMetadata.authorization_servers[0]);
    const discoveredMetadataUrl = new URL(`/.well-known/oauth-authorization-server${discoveredIssuer.pathname}`, discoveredIssuer.origin);
    const discoveredMetadata = await fetch(discoveredMetadataUrl);
    assert.equal(discoveredMetadata.status, 200);
    assert.equal((await discoveredMetadata.json()).issuer, metadata.issuer);

    await auth.registerMcpServer({
      id: 'tasks',
      name: 'Tasks',
      version: '1.0.0',
      resource: `${origin}/api/tasks/mcp`,
      scopes: ['mcp:use'],
      requiredScopes: ['mcp:use'],
    });
    app.get('/api/tasks/mcp', auth.express().authenticate({ audience: `${origin}/api/tasks/mcp` }), (_req, res) => res.status(204).send());

    const challenge = await fetch(new URL('/api/tasks/mcp', origin));
    assert.equal(challenge.status, 401);
    const authenticate = challenge.headers.get('www-authenticate');
    assert.equal(authenticate, `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/tasks/mcp"`);
    const advertisedResourceMetadataUrl = authenticate.match(/resource_metadata="([^"]+)"/)?.[1];
    assert(advertisedResourceMetadataUrl);
    const advertisedResourceMetadata = await fetch(advertisedResourceMetadataUrl);
    assert.equal(advertisedResourceMetadata.status, 200);
    assert.deepEqual(await advertisedResourceMetadata.json(), {
      resource: `${origin}/api/tasks/mcp`,
      authorization_servers: [`${origin}/auth`],
      scopes_supported: ['mcp:use'],
      bearer_methods_supported: ['header'],
      resource_name: 'Tasks',
    });
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
