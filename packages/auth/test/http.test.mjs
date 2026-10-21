import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { Hono } from 'hono';
import { exactResource, OAuthServer, remoteJwks, ResourceServer, ScopeRegistry } from '@taico/auth';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  discoverResource,
  memoryCredentialStore,
  OAuthClient,
  OAuthClientError,
  TokenManager,
} from '@taico/auth/client';
import { authRouter, protectedResourceMetadata, requireAuth, requireScopes } from '@taico/auth/express';
import {
  authRoutes,
  bearerAuth,
  protectedResourceMetadata as honoProtectedResourceMetadata,
  requireScopes as honoRequireScopes,
} from '@taico/auth/hono';
import { localIdp } from '@taico/auth/idp-local';
import { MemoryUserStore, memoryStores, staticResources } from '@taico/auth/memory';

/*
 * Two real HTTP servers: an authorization server (Express) and a separate
 * resource server that only knows the issuer's URL. The package's own OAuth
 * client drives the flow between them, the way a new app would be wired.
 */

const listen = (handler) =>
  new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });

let authHttp;
let apiHttp;
let issuer;
let apiUrl;
let otherApiUrl;
let oauth;
const scopes = [
  { id: 'notes:read', description: 'Read notes' },
  { id: 'notes:write', description: 'Write notes' },
];

before(async () => {
  // The resource server's URL has to be known to register it as a resource
  const api = express();
  apiHttp = await listen(api);
  apiUrl = `${apiHttp.url}/mcp`;
  otherApiUrl = `${apiHttp.url}/tasks`;
  const resource = { id: 'r1', identifier: 'notes', resourceUrl: apiUrl, name: 'Notes', scopes };
  // A second app behind the same authorization server
  const otherResource = { id: 'r2', identifier: 'tasks', resourceUrl: otherApiUrl, name: 'Tasks', scopes };

  const authApp = express();
  authHttp = await listen(authApp);
  issuer = authHttp.url;

  const identity = localIdp(new MemoryUserStore());
  await identity.createUser({ email: 'ada@example.com', password: 'correct horse', displayName: 'Ada' });
  oauth = new OAuthServer({
    config: { issuer },
    stores: memoryStores(),
    resources: staticResources([resource, otherResource]),
    identity,
    scopes: new ScopeRegistry(scopes),
  });
  authApp.use(express.json());
  authApp.use(authRouter(oauth));
  authApp.get('/other', (_req, res) => res.json({ other: true }));

  // The resource server shares nothing with the issuer but its JWKS URL
  const auth = new ResourceServer({
    issuer,
    jwks: remoteJwks(`${issuer}/.well-known/jwks.json`),
    audience: exactResource(apiUrl),
    baseUrl: apiHttp.url,
  });
  api.use(protectedResourceMetadata([resource, otherResource], { authorizationServers: [issuer] }));
  api.use(express.json());
  api.get('/mcp', requireAuth(auth), requireScopes('notes:read'), (req, res) =>
    res.json({ subject: req.auth.subject, viaLocals: res.locals.auth.subject }),
  );
  api.post('/mcp', requireAuth(auth), requireScopes('notes:write'), (_req, res) => res.json({ ok: true }));
  // Routes below the resource, and one outside it, behind the same check
  api.get('/mcp/notes/:id', requireAuth(auth), (_req, res) => res.json({ ok: true }));
  api.get('/api/notes', requireAuth(auth), (_req, res) => res.json({ ok: true }));

  // The official MCP SDK, reading the AuthContext requireAuth put on req.auth
  api.post('/mcp/sdk', requireAuth(auth), async (req, res) => {
    const mcp = new McpServer({ name: 'notes', version: '1.0.0' });
    mcp.registerTool('whoami', { description: 'Who is calling' }, async (extra) => ({
      content: [{ type: 'text', text: JSON.stringify({ ...extra.authInfo, resource: extra.authInfo?.resource?.href }) }],
    }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const otherAuth = new ResourceServer({
    issuer,
    jwks: remoteJwks(`${issuer}/.well-known/jwks.json`),
    audience: exactResource(otherApiUrl),
    baseUrl: apiHttp.url,
  });
  api.get('/tasks', requireAuth(otherAuth), (req, res) => res.json({ subject: req.auth.subject }));
});

after(() => {
  authHttp.server.close();
  apiHttp.server.close();
  authHttp.server.closeAllConnections();
  apiHttp.server.closeAllConnections();
});

/** Logs in and returns the session cookies as a Cookie header */
async function login() {
  const response = await fetch(`${issuer}/oauth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: issuer },
    body: JSON.stringify({ email: 'ada@example.com', password: 'correct horse' }),
  });
  assert.equal(response.status, 200);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) {
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  }
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

/** Follows the browser's part of the flow: authorize, then approve as the user */
async function approveInBrowser(authorizationUrl, cookie, approved = true) {
  const authorize = await fetch(authorizationUrl, { redirect: 'manual' });
  assert.equal(authorize.status, 302);
  const grantId = new URL(authorize.headers.get('location')).searchParams.get('grant_id');
  const consent = await fetch(`${issuer}/oauth/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, origin: issuer },
    body: JSON.stringify({ grant_id: grantId, approved }),
  });
  return { grantId, consent };
}

async function obtainTokens(scope = 'notes:read') {
  const client = new OAuthClient({ issuer });
  const redirectUri = 'http://127.0.0.1:9/callback';
  await client.register({ clientName: 'Test CLI', redirectUris: [redirectUri], scope });
  const request = await client.createAuthorizationRequest({ redirectUri, scope, resource: apiUrl });
  const { consent } = await approveInBrowser(request.url, await login());
  assert.equal(consent.status, 200);
  const callback = new URL((await consent.json()).redirect_to);
  assert.equal(callback.searchParams.get('state'), request.state);
  const tokens = await client.exchangeCode({
    code: callback.searchParams.get('code'),
    codeVerifier: request.codeVerifier,
    redirectUri,
    resource: apiUrl,
  });
  return { client, tokens };
}

test('discovery documents are served', async () => {
  const metadata = await (await fetch(`${issuer}/.well-known/oauth-authorization-server`)).json();
  assert.equal(metadata.issuer, issuer);
  assert.equal(metadata.token_endpoint, `${issuer}/oauth/token`);

  const jwks = await (await fetch(`${issuer}/.well-known/jwks.json`)).json();
  assert.ok(Array.isArray(jwks.keys));
  for (const key of jwks.keys) {
    assert.equal(key.d, undefined, 'private key material must never be published');
  }

  const resource = await (await fetch(`${apiHttp.url}/.well-known/oauth-protected-resource/mcp`)).json();
  assert.equal(resource.resource, apiUrl);
  assert.deepEqual(resource.authorization_servers, [issuer]);
});

test('the router leaves other routes alone', async () => {
  assert.deepEqual(await (await fetch(`${issuer}/other`)).json(), { other: true });
});

test('end to end: a client gets a token and calls a separate resource server', async () => {
  const { client, tokens } = await obtainTokens();

  const ok = await fetch(apiUrl, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.subject, body.viaLocals);

  // Valid token, missing scope
  const forbidden = await fetch(apiUrl, { method: 'POST', headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(forbidden.status, 403);
  assert.equal(
    forbidden.headers.get('www-authenticate'),
    `Bearer resource_metadata="${apiHttp.url}/.well-known/oauth-protected-resource/mcp", error="insufficient_scope", scope="notes:write"`,
  );

  const refreshed = await client.refresh(tokens);
  assert.notEqual(refreshed.accessToken, tokens.accessToken);
  assert.equal((await client.introspect(tokens.accessToken)).active, true);
  assert.equal((await client.introspect(refreshed.accessToken)).active, true);

  // Reusing the rotated refresh token revokes the grant, access tokens included
  await assert.rejects(client.refresh(tokens), (error) => error instanceof OAuthClientError && error.error === 'invalid_grant');
  assert.equal((await client.introspect(tokens.accessToken)).active, false);
  assert.equal((await client.introspect(refreshed.accessToken)).active, false);
});

test('requests without a usable token get a challenge pointing at the metadata', async () => {
  const missing = await fetch(apiUrl);
  assert.equal(missing.status, 401);
  assert.equal(
    missing.headers.get('www-authenticate'),
    `Bearer resource_metadata="${apiHttp.url}/.well-known/oauth-protected-resource/mcp"`,
  );
  const invalid = await fetch(apiUrl, { headers: { authorization: 'Bearer nope' } });
  assert.equal(invalid.status, 401);
  assert.match(invalid.headers.get('www-authenticate'), /error="invalid_token"/);

  // A token for the issuer's own API is not accepted by the resource server
  const firstParty = await oauth.issueToken({ subject: { id: 'x' }, scopes: ['notes:read'], ttlSeconds: 60 });
  const wrongAudience = await fetch(apiUrl, { headers: { authorization: `Bearer ${firstParty.token}` } });
  assert.equal(wrongAudience.status, 401);
});

test('a 401 on any route points at metadata that exists', async () => {
  const metadataUrl = `${apiHttp.url}/.well-known/oauth-protected-resource/mcp`;
  for (const path of ['/mcp/notes/1', '/mcp/notes/1?x=y', '/api/notes']) {
    const response = await fetch(`${apiHttp.url}${path}`);
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get('www-authenticate'), `Bearer resource_metadata="${metadataUrl}"`, path);
  }
  const metadata = await fetch(metadataUrl);
  assert.equal(metadata.status, 200);
  assert.equal((await metadata.json()).resource, apiUrl);
});

test('the MCP SDK receives the AuthContext as its AuthInfo, unconverted', async () => {
  const { tokens } = await obtainTokens();
  const mcp = new McpClient({ name: 'test', version: '1.0.0' });
  await mcp.connect(
    new StreamableHTTPClientTransport(new URL(`${apiUrl}/sdk`), {
      requestInit: { headers: { authorization: `Bearer ${tokens.accessToken}` } },
    }),
  );
  try {
    const result = await mcp.callTool({ name: 'whoami', arguments: {} });
    const info = JSON.parse(result.content[0].text);
    const claims = JSON.parse(Buffer.from(tokens.accessToken.split('.')[1], 'base64url').toString());
    assert.equal(info.token, tokens.accessToken);
    assert.equal(info.clientId, claims.client_id);
    assert.deepEqual(info.scopes, ['notes:read']);
    assert.equal(info.expiresAt, claims.exp);
    assert.equal(info.resource, apiUrl);
    assert.equal(info.extra.subject, claims.sub);
    assert.equal(info.subject, claims.sub);
  } finally {
    await mcp.close();
  }
});

/** A TokenManager whose browser step is played by the test, as the logged-in user */
function managerFor(options, store) {
  let browserRuns = 0;
  const manager = new TokenManager({
    store,
    clientName: 'Test CLI',
    ...options,
    onAuthorizationUrl: async (url) => {
      browserRuns += 1;
      const cookie = await login();
      void (async () => {
        const { consent } = await approveInBrowser(url, cookie);
        await fetch((await consent.json()).redirect_to);
      })();
    },
  });
  return { manager, browserRuns: () => browserRuns };
}

test('the client finds the authorization server from the resource URL alone', async () => {
  // From a route below the resource: the 401 leads to the resource's metadata
  const discovered = await discoverResource(`${apiUrl}/notes/1`);
  assert.equal(discovered.resource, apiUrl);
  assert.deepEqual(discovered.authorizationServers, [issuer]);
  assert.deepEqual(discovered.scopesSupported, ['notes:read', 'notes:write']);

  const { manager } = managerFor({ resource: apiUrl, scope: 'notes:read' }, memoryCredentialStore());
  const token = await manager.getAccessToken();
  assert.equal((await fetch(apiUrl, { headers: { authorization: `Bearer ${token}` } })).status, 200);
});

test('the client refuses metadata that describes another resource', async () => {
  const liar = await listen((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ resource: 'https://evil.example.com/mcp', authorization_servers: ['https://evil.example.com'] }));
  });
  try {
    await assert.rejects(discoverResource(`${liar.url}/mcp`), /describes another resource/);
  } finally {
    liar.server.close();
    liar.server.closeAllConnections();
  }
});

test('the client keeps separate tokens for two resources behind one issuer', async () => {
  const store = memoryCredentialStore();
  const notes = managerFor({ issuer, resource: apiUrl, scope: 'notes:read' }, store);
  const tasks = managerFor({ resource: otherApiUrl, scope: 'notes:read' }, store);
  const notesToken = await notes.manager.getAccessToken();
  const tasksToken = await tasks.manager.getAccessToken();
  assert.notEqual(notesToken, tasksToken);
  assert.equal((await store.read(issuer, apiUrl)).accessToken, notesToken);
  assert.equal((await store.read(issuer, otherApiUrl)).accessToken, tasksToken);

  // Each app accepts its own token and refuses the other one
  const call = (url, token) => fetch(url, { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await call(apiUrl, notesToken)).status, 200);
  assert.equal((await call(otherApiUrl, tasksToken)).status, 200);
  assert.equal((await call(otherApiUrl, notesToken)).status, 401);
  assert.equal((await call(apiUrl, tasksToken)).status, 401);

  // A new process reuses the stored tokens without going through the browser again
  const again = managerFor({ resource: otherApiUrl, scope: 'notes:read' }, store);
  assert.equal(await again.manager.getAccessToken(), tasksToken);
  assert.equal(again.browserRuns(), 0);
});

test('consent needs a logged-in user and a trusted origin', async () => {
  const client = new OAuthClient({ issuer });
  const redirectUri = 'http://127.0.0.1:9/callback';
  await client.register({ clientName: 'c', redirectUris: [redirectUri] });
  const request = await client.createAuthorizationRequest({ redirectUri, resource: apiUrl });

  const anonymous = await approveInBrowser(request.url, '');
  assert.equal(anonymous.consent.status, 401);

  const cookie = await login();
  const crossSite = await fetch(`${issuer}/oauth/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, origin: 'https://evil.example.com' },
    body: JSON.stringify({ grant_id: anonymous.grantId, approved: true }),
  });
  assert.equal(crossSite.status, 403);

  // A resource token is not a session: it cannot approve a consent
  const { tokens } = await obtainTokens();
  const withResourceToken = await fetch(`${issuer}/oauth/consent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.accessToken}` },
    body: JSON.stringify({ grant_id: anonymous.grantId, approved: true }),
  });
  assert.equal(withResourceToken.status, 401);

  const details = await (await fetch(`${issuer}/oauth/consent/${anonymous.grantId}`)).json();
  assert.equal(details.client.clientName, 'c');
  assert.equal(details.status, 'pending');
});

test('session POSTs without a trusted Origin or Referer are refused', async () => {
  const client = new OAuthClient({ issuer });
  const redirectUri = 'http://127.0.0.1:9/callback';
  await client.register({ clientName: 'c', redirectUris: [redirectUri] });
  const request = await client.createAuthorizationRequest({ redirectUri, resource: apiUrl });
  const authorize = await fetch(request.url, { redirect: 'manual' });
  const grantId = new URL(authorize.headers.get('location')).searchParams.get('grant_id');
  const cookie = await login();

  const post = (path, headers, body = {}) =>
    fetch(`${issuer}/oauth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const approval = { grant_id: grantId, approved: true };
  const credentials = { email: 'ada@example.com', password: 'correct horse' };

  // Sources that must not be trusted, each with the session cookie attached
  const untrusted = {
    'no Origin and no Referer': {},
    'an opaque Origin': { origin: 'null' },
    'an opaque Origin with a trusted Referer': { origin: 'null', referer: `${issuer}/consent` },
    'a foreign Origin with a trusted Referer': { origin: 'https://evil.example.com', referer: `${issuer}/consent` },
    'a foreign Referer': { referer: 'https://evil.example.com/page' },
    'a Referer that only starts with the issuer': { referer: `${issuer}.evil.example.com/page` },
    'a Referer that is not a URL': { referer: 'not a url' },
  };
  for (const [name, headers] of Object.entries(untrusted)) {
    const consent = await post('consent', { cookie, ...headers }, approval);
    assert.equal(consent.status, 403, `consent with ${name}`);
    assert.equal((await consent.json()).error, 'invalid_request');
    assert.equal((await post('session/refresh', { cookie, ...headers })).status, 403, `refresh with ${name}`);
    const logout = await post('logout', { cookie, ...headers });
    assert.equal(logout.status, 403, `logout with ${name}`);
    assert.equal(logout.headers.getSetCookie().length, 0);
    const loggedIn = await post('login', headers, credentials);
    assert.equal(loggedIn.status, 403, `login with ${name}`);
    assert.equal(loggedIn.headers.getSetCookie().length, 0);
  }

  // None of the refused requests took effect
  const details = await (await fetch(`${issuer}/oauth/consent/${grantId}`)).json();
  assert.equal(details.status, 'pending');
  assert.equal((await fetch(`${issuer}/oauth/session`, { headers: { cookie } })).status, 200);

  // With no Origin, a Referer from the issuer is enough
  const referer = `${issuer}/consent?grant_id=${grantId}`;
  const refreshed = await post('session/refresh', { cookie, referer });
  assert.equal(refreshed.status, 200);
  const newCookie = refreshed.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  assert.equal((await post('consent', { cookie: newCookie, referer }, approval)).status, 200);
  assert.equal((await post('logout', { cookie: newCookie, referer })).status, 200);
});

test('trustedOrigins extends the allowed origins; a session bearer token needs none', async () => {
  const app = new Hono();
  app.use('*', authRoutes(oauth, { trustedOrigins: ['http://ui.localhost:5173'] }));
  const post = (path, headers, body = {}) =>
    app.request(`${issuer}/oauth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const credentials = { email: 'ada@example.com', password: 'correct horse' };

  assert.equal((await post('login', {}, credentials)).status, 403);
  assert.equal((await post('login', { origin: 'http://other.localhost:5173' }, credentials)).status, 403);
  assert.equal((await post('login', { origin: 'http://ui.localhost:5173' }, credentials)).status, 200);
  assert.equal((await post('login', { referer: 'http://ui.localhost:5173/login' }, credentials)).status, 200);

  // A header the browser never adds by itself cannot be forged across sites
  const client = new OAuthClient({ issuer });
  const redirectUri = 'http://127.0.0.1:9/callback';
  await client.register({ clientName: 'c', redirectUris: [redirectUri] });
  const request = await client.createAuthorizationRequest({ redirectUri, resource: apiUrl });
  const authorize = await fetch(request.url, { redirect: 'manual' });
  const grantId = new URL(authorize.headers.get('location')).searchParams.get('grant_id');
  const sessionToken = (await login()).match(/access_token=([^;]+)/)[1];
  const consent = await post(
    'consent',
    { authorization: `Bearer ${decodeURIComponent(sessionToken)}` },
    { grant_id: grantId, approved: true },
  );
  assert.equal(consent.status, 200);
});

test('OAuth errors use the RFC 6749 shape; form bodies are accepted', async () => {
  const response = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=x&code_verifier=y&redirect_uri=z&client_id=c',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_grant');
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const badAuthorize = await fetch(`${issuer}/oauth/authorize?response_type=code&client_id=nope&redirect_uri=https://evil.example.com`, { redirect: 'manual' });
  assert.equal(badAuthorize.status, 401, 'an unknown client is never redirected to its redirect_uri');
});

test('session endpoints: bad password, refresh, logout', async () => {
  const bad = await fetch(`${issuer}/oauth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: issuer },
    body: JSON.stringify({ email: 'ada@example.com', password: 'nope' }),
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.getSetCookie().length, 0);

  const cookie = await login();
  assert.equal((await fetch(`${issuer}/oauth/session`, { headers: { cookie } })).status, 200);
  const refreshed = await fetch(`${issuer}/oauth/session/refresh`, { method: 'POST', headers: { cookie, origin: issuer } });
  assert.equal(refreshed.status, 200);
  const newCookie = refreshed.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const logout = await fetch(`${issuer}/oauth/logout`, { method: 'POST', headers: { cookie: newCookie, origin: issuer } });
  assert.match(logout.headers.getSetCookie()[0], /Max-Age=0/);
  assert.equal((await fetch(`${issuer}/oauth/session/refresh`, { method: 'POST', headers: { cookie: newCookie, origin: issuer } })).status, 401);
});

test('Hono: the same server and the same checks', async () => {
  const auth = oauth.resourceServer({ audience: exactResource(apiUrl) });
  const app = new Hono();
  app.use('*', authRoutes(oauth));
  app.get('/mcp', bearerAuth(auth), honoRequireScopes('notes:read'), (c) =>
    c.json({ subject: c.get('auth').subject }),
  );
  app.post('/mcp', bearerAuth(auth), honoRequireScopes('notes:write'), (c) => c.json({ ok: true }));
  app.get('/mcp/notes/:id', bearerAuth(auth), (c) => c.json({ ok: true }));
  app.get('/mcp/whoami', bearerAuth(auth), (c) => {
    const { clientId, resource } = c.get('auth');
    return c.json({ clientId, resource: resource?.href });
  });
  // Addressed as if it were served at the resource URL
  const request = (path, init) => app.request(`${apiHttp.url}${path}`, init);

  const metadata = await request('/.well-known/oauth-authorization-server');
  assert.equal((await metadata.json()).issuer, issuer);

  const { tokens } = await obtainTokens();
  const headers = { authorization: `Bearer ${tokens.accessToken}` };
  assert.equal((await request('/mcp', { headers })).status, 200);

  const metadataUrl = `${apiHttp.url}/.well-known/oauth-protected-resource/mcp`;
  const forbidden = await request('/mcp', { method: 'POST', headers });
  assert.equal(forbidden.status, 403);
  assert.equal(
    forbidden.headers.get('www-authenticate'),
    `Bearer resource_metadata="${metadataUrl}", error="insufficient_scope", scope="notes:write"`,
  );

  const missing = await request('/mcp');
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get('www-authenticate'), `Bearer resource_metadata="${metadataUrl}"`);
  // A route below the resource points at the same metadata
  const below = await request('/mcp/notes/1');
  assert.equal(below.headers.get('www-authenticate'), `Bearer resource_metadata="${metadataUrl}"`);
  const context = await (await request('/mcp/whoami', { headers })).json();
  assert.equal(context.resource, apiUrl);
  assert.equal(typeof context.clientId, 'string');
  assert.ok(context.clientId.length > 0);

  const token = await request('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=nope',
  });
  assert.equal(token.status, 400);
  assert.equal((await token.json()).error, 'unsupported_grant_type');
});

// ---------------------------------------------------------------- built-in pages

/** Cookie header from a response's Set-Cookie headers */
const cookieFrom = (response) =>
  response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');

test('out of the box, the browser is sent to a login page and a consent page that exist', async () => {
  const client = new OAuthClient({ issuer });
  const redirectUri = 'http://127.0.0.1:9/callback';
  // The client names itself; the page must show the name, not run it
  await client.register({ clientName: '<script>alert(1)</script>', redirectUris: [redirectUri] });
  const request = await client.createAuthorizationRequest({ redirectUri, scope: 'notes:read', resource: apiUrl });

  const authorize = await fetch(request.url, { redirect: 'manual' });
  const consentUrl = new URL(authorize.headers.get('location'));
  assert.equal(consentUrl.origin + consentUrl.pathname, `${issuer}/oauth/consent`);

  // Not logged in: sent to the login page, which comes back here
  const anonymous = await fetch(consentUrl, { redirect: 'manual' });
  assert.equal(anonymous.status, 302);
  const loginUrl = new URL(anonymous.headers.get('location'), issuer);
  assert.equal(loginUrl.pathname, '/oauth/login');
  const returnTo = loginUrl.searchParams.get('return_to');
  assert.equal(returnTo, `${consentUrl.pathname}${consentUrl.search}`);

  const loginPage = await fetch(loginUrl);
  assert.equal(loginPage.status, 200);
  assert.match(loginPage.headers.get('content-type'), /text\/html/);
  assert.match(loginPage.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(loginPage.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(loginPage.headers.get('x-frame-options'), 'DENY');
  const loginHtml = await loginPage.text();
  assert.match(loginHtml, /<form method="post" action="\/oauth\/login">/);
  assert.ok(loginHtml.includes(`value="${returnTo.replace(/&/g, '&amp;')}"`));

  // A wrong password sends the browser back to the form, with no cookies
  const form = (fields) => ({
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: issuer },
    body: new URLSearchParams(fields).toString(),
  });
  const wrong = await fetch(`${issuer}/oauth/login`, form({ email: 'ada@example.com', password: 'nope', return_to: returnTo }));
  assert.equal(wrong.status, 303);
  assert.equal(wrong.headers.getSetCookie().length, 0);
  const retry = new URL(wrong.headers.get('location'), issuer);
  assert.equal(retry.pathname, '/oauth/login');
  assert.equal(retry.searchParams.get('return_to'), returnTo);
  assert.match(await (await fetch(retry)).text(), /Wrong email or password/);

  // The form post still needs a trusted origin
  const forged = await fetch(`${issuer}/oauth/login`, {
    ...form({ email: 'ada@example.com', password: 'correct horse', return_to: returnTo }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example.com' },
  });
  assert.equal(forged.status, 403);

  const signedIn = await fetch(`${issuer}/oauth/login`, form({ email: 'ada@example.com', password: 'correct horse', return_to: returnTo }));
  assert.equal(signedIn.status, 303);
  assert.equal(signedIn.headers.get('location'), returnTo);
  const cookie = cookieFrom(signedIn);

  const consentPage = await fetch(consentUrl, { headers: { cookie } });
  assert.equal(consentPage.status, 200);
  assert.match(consentPage.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await consentPage.text();
  assert.ok(!html.includes('<script>'), 'client-supplied text is escaped');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(html, /notes:read/);
  assert.match(html, /Notes/);
  assert.match(html, /127\.0\.0\.1:9/);
  assert.match(html, /<form method="post" action="\/oauth\/consent">/);

  // The page's form: approving redirects to the client with a code
  const grantId = consentUrl.searchParams.get('grant_id');
  const approved = await fetch(`${issuer}/oauth/consent`, {
    ...form({ grant_id: grantId, approved: 'true' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: issuer, cookie },
  });
  assert.equal(approved.status, 303);
  const callback = new URL(approved.headers.get('location'));
  assert.equal(`${callback.origin}${callback.pathname}`, redirectUri);
  assert.equal(callback.searchParams.get('state'), request.state);
  const tokens = await client.exchangeCode({
    code: callback.searchParams.get('code'),
    codeVerifier: request.codeVerifier,
    redirectUri,
    resource: apiUrl,
  });
  assert.equal((await fetch(apiUrl, { headers: { authorization: `Bearer ${tokens.accessToken}` } })).status, 200);

  // An answered request is not offered again
  assert.equal((await fetch(consentUrl, { headers: { cookie } })).status, 409);
  assert.equal((await fetch(`${issuer}/oauth/consent?grant_id=nope`, { headers: { cookie } })).status, 404);
  assert.equal((await fetch(`${issuer}/oauth/consent`, { headers: { cookie } })).status, 400);
});

test('the login form only returns to a path on the issuer', async () => {
  const signIn = async (returnTo) => {
    const response = await fetch(`${issuer}/oauth/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: issuer },
      body: new URLSearchParams({ email: 'ada@example.com', password: 'correct horse', return_to: returnTo }).toString(),
    });
    assert.equal(response.status, 303);
    return response.headers.get('location');
  };
  for (const hostile of ['https://evil.example.com/', '//evil.example.com/x', '/\\evil.example.com', 'javascript:alert(1)', '']) {
    assert.equal(await signIn(hostile), '/', `return_to ${JSON.stringify(hostile)}`);
  }
  assert.equal(await signIn('/oauth/consent?grant_id=a&b=c'), '/oauth/consent?grant_id=a&b=c');
});

test('the pages can be turned off', async () => {
  const app = new Hono();
  app.use('*', authRoutes(oauth, { pages: false }));
  app.all('*', (c) => c.text('host', 404));
  assert.equal(await (await app.request(`${issuer}/oauth/login`)).text(), 'host');
  assert.equal(await (await app.request(`${issuer}/oauth/consent?grant_id=x`)).text(), 'host');

  // On Hono the pages are served too, as HTML
  const withPages = new Hono();
  withPages.use('*', authRoutes(oauth));
  const page = await withPages.request(`${issuer}/oauth/login`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
});

// ---------------------------------------------------------------- metadata, client

test('protected resource metadata can name a different authorization server per resource', async () => {
  const resources = [
    { id: 'a', identifier: 'a', resourceUrl: 'https://h.example.com/mcp/a', name: 'A', scopes: [] },
    { id: 'b', identifier: 'b', resourceUrl: 'https://h.example.com/mcp/b', name: 'B', scopes: [] },
  ];
  const options = {
    authorizationServers: async (resource) => [`https://taico.example.com/auth/mcp/${resource.identifier}`],
  };
  const app = express();
  app.use(protectedResourceMetadata(resources, options));
  app.use((_req, res) => res.status(404).json({ fallthrough: true }));
  const http = await listen(app);
  const honoApp = new Hono();
  honoApp.use('*', honoProtectedResourceMetadata(resources, options));
  try {
    for (const [name, get] of [
      ['express', (path) => fetch(`${http.url}${path}`)],
      ['hono', (path) => honoApp.request(`http://h.example.com${path}`)],
    ]) {
      const a = await (await get('/.well-known/oauth-protected-resource/mcp/a')).json();
      assert.deepEqual(a.authorization_servers, ['https://taico.example.com/auth/mcp/a'], name);
      const b = await (await get('/.well-known/oauth-protected-resource/mcp/b')).json();
      assert.deepEqual(b.authorization_servers, ['https://taico.example.com/auth/mcp/b'], name);
      assert.equal((await get('/.well-known/oauth-protected-resource/mcp/c')).status, 404, name);
      // Only the well-known path itself, not look-alikes
      assert.equal((await get('/.well-known/oauth-protected-resourcexyz/mcp/a')).status, 404, name);
    }
  } finally {
    http.server.close();
    http.server.closeAllConnections();
  }
});

test('re-authorizing reuses the registered client instead of registering another', async () => {
  const registered = [];
  const original = oauth.register.bind(oauth);
  oauth.register = async (request) => {
    const client = await original(request);
    registered.push(client.clientId);
    return client;
  };
  try {
    const store = memoryCredentialStore();
    const { manager, browserRuns } = managerFor({ issuer, resource: apiUrl, scope: 'notes:read' }, store);
    await manager.getAccessToken();
    const first = await store.read(issuer, apiUrl);
    assert.equal(registered.length, 1);

    // The grant ends: the refresh token is refused, so the browser flow runs again
    await oauth.revoke({ token: first.refreshToken });
    const token = await manager.getAccessToken({ forceRefresh: true });
    assert.equal(browserRuns(), 2);
    assert.equal(registered.length, 1, 'no second client');
    const second = await store.read(issuer, apiUrl);
    assert.equal(second.clientId, first.clientId);
    assert.notEqual(second.refreshToken, first.refreshToken);
    assert.equal((await fetch(apiUrl, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  } finally {
    oauth.register = original;
  }
});

test('fileCredentialStore expands ~ to the home directory', async () => {
  const { mkdtemp, readFile: read, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileCredentialStore } = await import('@taico/auth/client');
  const home = await mkdtemp(join(tmpdir(), 'taico-auth-home-'));
  const previous = process.env.HOME;
  process.env.HOME = home;
  try {
    const store = fileCredentialStore('~/.myapp/credentials.json');
    await store.write({ issuer, resource: apiUrl, clientId: 'c', redirectUri: 'r', accessToken: 'a', scope: '', expiresAt: new Date().toISOString() });
    const saved = JSON.parse(await read(join(home, '.myapp', 'credentials.json'), 'utf8'));
    assert.ok(saved.servers);
    assert.equal((await store.read(issuer, apiUrl)).accessToken, 'a');
  } finally {
    process.env.HOME = previous;
    await rm(home, { recursive: true, force: true });
  }
});
