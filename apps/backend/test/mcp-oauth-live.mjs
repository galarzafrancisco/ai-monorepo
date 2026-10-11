// Live test of the MCP OAuth flow with a real MCP client. Run after a build:
//   npm run build && npm -w apps/backend run test:live:mcp-oauth
//
// Starts one backend process on a throwaway database and connects to the tasks
// and context MCP servers with the official MCP SDK client, letting the SDK do
// discovery, dynamic client registration, PKCE and the token request. The only
// scripted part is the human: logging in and approving the consent screen.
// Checks that:
//   1. the SDK discovers each server and completes the OAuth flow unaided
//   2. the advertised authorization server and its metadata issuer match exactly
//   3. each token's audience is the MCP server URL the client connected to
//   4. a token for one MCP server is rejected by the other
//   5. the SDK can refresh, and the refreshed token keeps its audience
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
const require = createRequire(process.cwd() + '/package.json');
const { Client: PgClient } = require('pg');
const { decodeJwt } = require('jose');

const PORT = 39511;
const BASE = `http://127.0.0.1:${PORT}`;
const REDIRECT_URI = 'http://127.0.0.1:39512/oauth/callback';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[live]', ...a);

// ---- database + backend -------------------------------------------------
const adminUrl = new URL(
  process.env.POSTGRES_ADMIN_URL ?? 'postgresql://taico:taico@127.0.0.1:5432/postgres',
);
const dbName = `taico_test_live_${process.pid}`;
const admin = new PgClient({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${dbName}"`);
const dbUrl = new URL(adminUrl); dbUrl.pathname = `/${dbName}`;

const backend = spawn(process.execPath, ['dist/main.js', '--server'], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: dbUrl.toString(), TYPEORM_SCHEMA_MODE: 'migrate',
    ISSUER_URL: BASE, BACKEND_PORT: String(PORT), THREAD_STATE_RECONCILER_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let backendOutput = '';
backend.stdout.on('data', (d) => (backendOutput += d)); backend.stderr.on('data', (d) => (backendOutput += d));
const waitUp = async () => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${BASE}/api/v1/ai-providers`); if (r.status < 500) return; } catch {}
    if (backend.exitCode !== null) throw new Error(`backend exited:\n${backendOutput.slice(-3000)}`);
    await sleep(500);
  }
  throw new Error(`backend did not start:\n${backendOutput.slice(-3000)}`);
};

// ---- the human: logs in once, approves every consent screen ---------------
let cookie = '';
const approveConsent = async (authorizationUrl) => {
  const authorize = await fetch(authorizationUrl, { redirect: 'manual' });
  assert.equal(authorize.status, 302, `authorize -> ${authorize.status} ${await authorize.text()}`);
  const consentScreen = new URL(authorize.headers.get('location'));
  const flowId = consentScreen.searchParams.get('flow');
  assert.ok(flowId, `no consent flow in ${consentScreen}`);

  const consent = await fetch(`${authorizationUrl.origin}${authorizationUrl.pathname}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ flow_id: flowId, approved: true }),
  });
  assert.equal(consent.status, 302, `consent -> ${consent.status} ${await consent.text()}`);
  const callback = new URL(consent.headers.get('location'));
  assert.equal(callback.searchParams.get('error'), null, `authorization failed: ${callback}`);
  return callback.searchParams.get('code');
};

// ---- the MCP client: in-memory OAuth storage, everything else is the SDK ---
class MemoryOAuthProvider {
  authorizationUrls = [];
  get redirectUrl() { return REDIRECT_URI; }
  get clientMetadata() {
    return { client_name: 'Taico live MCP client', redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' };
  }
  // Taico requires `state`; the SDK only sends one when the provider supplies it
  state() { return randomBytes(16).toString('hex'); }
  clientInformation() { return this.client; }
  saveClientInformation(client) { this.client = client; }
  tokens() { return this.savedTokens; }
  saveTokens(tokens) { this.savedTokens = tokens; }
  saveCodeVerifier(verifier) { this.verifier = verifier; }
  codeVerifier() { return this.verifier; }
  async redirectToAuthorization(url) {
    this.authorizationUrls.push(url);
    this.code = await approveConsent(url);
  }
}

const connect = async (mcpUrl, provider) => {
  const newClient = () => new McpClient({ name: 'taico-live-mcp-client', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider });
  try {
    const client = newClient();
    await client.connect(transport);
    return client;
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
    await transport.finishAuth(provider.code);
  }
  const client = newClient();
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider }));
  return client;
};

const rawMcpCall = (mcpUrl, token) => fetch(mcpUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '0.0.0' } } }),
});

let failed = false;
try {
  await waitUp(); log('backend up');

  const login = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.com', password: 'admin' }) });
  assert.ok(login.ok, `login failed ${login.status}`);
  cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  const servers = {
    tasks: { url: `${BASE}/api/v1/tasks/tasks/mcp`, provider: new MemoryOAuthProvider() },
    context: { url: `${BASE}/api/v1/context/blocks/mcp`, provider: new MemoryOAuthProvider() },
  };

  for (const [name, server] of Object.entries(servers)) {
    // 1. the SDK discovers the server and completes the OAuth flow
    server.client = await connect(server.url, server.provider);
    const { tools } = await server.client.listTools();
    assert.ok(tools.length > 0, `${name}: no tools listed`);
    log(`${name}: connected through OAuth, ${tools.length} tools`);

    // 2. advertised authorization server == metadata issuer (RFC 8414 section 3.3)
    const unauthenticated = await fetch(server.url, { method: 'POST' });
    assert.equal(unauthenticated.status, 401);
    const resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(unauthenticated.headers.get('www-authenticate'))[1];
    const resourceMetadata = await (await fetch(resourceMetadataUrl)).json();
    assert.equal(resourceMetadata.resource, server.url);
    const advertisedIssuer = new URL(resourceMetadata.authorization_servers[0]);
    const metadata = await (await fetch(`${advertisedIssuer.origin}/.well-known/oauth-authorization-server${advertisedIssuer.pathname}`)).json();
    assert.equal(metadata.issuer, advertisedIssuer.toString(), `${name}: issuer mismatch`);
    log(`${name}: issuer matches ${metadata.issuer}`);

    // 3. the SDK asked for this resource and the token is bound to it
    assert.equal(server.provider.authorizationUrls.length, 1, `${name}: expected one authorization round trip`);
    assert.equal(server.provider.authorizationUrls[0].searchParams.get('resource'), server.url);
    const claims = decodeJwt(server.provider.savedTokens.access_token);
    assert.equal(claims.aud, server.url, `${name}: wrong audience`);
    assert.equal(claims.mcp_server_identifier, name);
    log(`${name}: token audience is ${claims.aud}`);
  }

  // 4. a token for one MCP server is rejected by the other
  const tasksToken = servers.tasks.provider.savedTokens.access_token;
  const contextToken = servers.context.provider.savedTokens.access_token;
  assert.equal((await rawMcpCall(servers.tasks.url, tasksToken)).status, 200);
  assert.equal((await rawMcpCall(servers.context.url, contextToken)).status, 200);
  for (const [url, token] of [[servers.context.url, tasksToken], [servers.tasks.url, contextToken]]) {
    const rejected = await rawMcpCall(url, token);
    assert.equal(rejected.status, 401, `cross-server token accepted at ${url}`);
    assert.match(rejected.headers.get('www-authenticate'), /error="invalid_token"/);
  }
  log('cross-server tokens rejected');

  // 5. drop the access token: the SDK refreshes, and the new token keeps its audience
  const { provider, url } = servers.tasks;
  const before = provider.savedTokens;
  provider.savedTokens = { ...before, access_token: 'expired' };
  const refreshedClient = await connect(url, provider);
  await refreshedClient.listTools();
  assert.equal(provider.authorizationUrls.length, 1, 'refresh should not need a new consent');
  assert.notEqual(provider.savedTokens.access_token, 'expired');
  assert.notEqual(provider.savedTokens.refresh_token, before.refresh_token, 'refresh token was not rotated');
  assert.equal(decodeJwt(provider.savedTokens.access_token).aud, url);
  log('refresh kept the audience');

  await Promise.all([servers.tasks.client.close(), servers.context.client.close(), refreshedClient.close()]);
  log('ALL LIVE CHECKS PASSED');
} catch (error) {
  failed = true;
  console.error('[live] FAILED:', error);
  console.error(backendOutput.slice(-2000));
} finally {
  backend.kill('SIGTERM');
  await sleep(1500);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [dbName]);
  await admin.query(`DROP DATABASE "${dbName}"`);
  await admin.end();
  process.exit(failed ? 1 : 0);
}
