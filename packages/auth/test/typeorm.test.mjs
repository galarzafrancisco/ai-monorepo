import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DataSource } from 'typeorm';
import { OAuthError } from '@taico/auth';
import {
  authEntities,
  CreateAuthTables1760000000000,
  typeormStores,
  typeormUserStore,
} from '@taico/auth/typeorm';
import { authorizeClient, createTestServer, ISSUER, tokenRequest } from './helpers.mjs';

/* The same flows as the in-memory tests, on a real database (SQLite). */

let dataSource;

before(async () => {
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: authEntities,
    migrations: [CreateAuthTables1760000000000],
  });
  await dataSource.initialize();
  // Tables come from the migration, not from synchronize
  await dataSource.runMigrations();
});

after(() => dataSource.destroy());

let users = 0;
// Every test shares the database, so each gets a user of its own
const create = () =>
  createTestServer({
    stores: typeormStores(dataSource),
    users: typeormUserStore(dataSource),
    email: `user${(users += 1)}@example.com`,
  });

test('the migration creates every table the entities describe', async () => {
  const tables = await dataSource.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'auth_%' ORDER BY name",
  );
  assert.deepEqual(
    tables.map((table) => table.name),
    ['auth_clients', 'auth_grants', 'auth_issued_tokens', 'auth_keys', 'auth_refresh_tokens', 'auth_users'],
  );
});

test('authorization code flow, refresh rotation and reuse detection on TypeORM', async () => {
  const { server, user } = await create();
  const flow = await authorizeClient(server, user);
  const tokens = await server.token(tokenRequest(flow));
  const context = await server
    .resourceServer({ audience: { accepts: () => true } })
    .authenticateToken(tokens.access_token, ISSUER);
  assert.equal(context.subject, user.id);
  assert.deepEqual(context.scopes, ['notes:read']);

  const refresh = (refresh_token) =>
    server.token({ grant_type: 'refresh_token', client_id: flow.client.clientId, refresh_token });
  const second = await refresh(tokens.refresh_token);
  await assert.rejects(refresh(tokens.refresh_token), OAuthError);
  await assert.rejects(refresh(second.refresh_token), OAuthError);
});

test('a code is redeemed once even when two requests race', async () => {
  const { server, user } = await create();
  const flow = await authorizeClient(server, user);
  const results = await Promise.allSettled([
    server.token(tokenRequest(flow)),
    server.token(tokenRequest(flow)),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
});

test('keys, clients and dates survive a round trip through the database', async () => {
  const stores = typeormStores(dataSource);
  const active = await stores.keys.findActive(new Date());
  assert.ok(active.expiresAt instanceof Date);
  assert.ok(active.expiresAt > new Date());
  assert.equal((await stores.keys.listVerifiable(new Date(0))).length >= 1, true);
  assert.equal((await stores.keys.listVerifiable(new Date(8.64e15))).length, 0);

  const client = await stores.clients.save({
    clientId: 'https://app.example.com/client.json',
    clientName: 'Comma, Inc',
    redirectUris: ['https://app.example.com/cb?a=1,2'],
    grantTypes: ['authorization_code'],
    tokenEndpointAuthMethod: 'private_key_jwt',
    registrationMethod: 'metadata_document',
    scopes: [],
    contacts: null,
    jwksUri: null,
    jwks: { keys: [{ kty: 'RSA', n: 'x', e: 'AQAB' }] },
    tokenEndpointAuthSigningAlg: null,
    metadataExpiresAt: new Date(1_800_000_000_000),
    createdAt: new Date(),
  });
  const loaded = await stores.clients.findByClientId(client.clientId);
  assert.deepEqual(loaded.redirectUris, ['https://app.example.com/cb?a=1,2']);
  assert.deepEqual(loaded.jwks, client.jwks);
  assert.equal(loaded.metadataExpiresAt.getTime(), 1_800_000_000_000);
});

test('issued tokens: record, revoke, and revoke one that was never recorded', async () => {
  const { server } = await create();
  const stores = typeormStores(dataSource);
  const issued = await server.issueToken({
    subject: { id: 'agent-1' },
    scopes: ['notes:read'],
    ttlSeconds: 3600,
    record: { name: 'agent token' },
  });
  assert.equal(await stores.issuedTokens.isRevoked(issued.jti), false);
  await server.revokeIssuedToken(issued.jti);
  assert.equal(await stores.issuedTokens.isRevoked(issued.jti), true);
  const [listed] = await stores.issuedTokens.listBySubject('agent-1');
  assert.equal(listed.name, 'agent token');
  assert.ok(listed.revokedAt instanceof Date);

  await stores.issuedTokens.revoke('never-recorded');
  assert.equal(await stores.issuedTokens.isRevoked('never-recorded'), true);
  assert.equal(await stores.issuedTokens.isRevoked('unknown'), false);
});
