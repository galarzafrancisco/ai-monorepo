import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { Hono } from 'hono';
import { exactResource, OAuthServer, remoteJwks, ResourceServer, ScopeRegistry } from '@taico/auth';
import { OAuthClient, OAuthClientError } from '@taico/auth/client';
import { authRouter, protectedResourceMetadata, requireAuth, requireScopes } from '@taico/auth/express';
import { authRoutes, bearerAuth, requireScopes as honoRequireScopes } from '@taico/auth/hono';
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
  const resource = { id: 'r1', identifier: 'notes', resourceUrl: apiUrl, name: 'Notes', scopes };

  const authApp = express();
  authHttp = await listen(authApp);
  issuer = authHttp.url;

  const identity = localIdp(new MemoryUserStore());
  await identity.createUser({ email: 'ada@example.com', password: 'correct horse', displayName: 'Ada' });
  oauth = new OAuthServer({
    config: { issuer },
    stores: memoryStores(),
    resources: staticResources([resource]),
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
  api.use(protectedResourceMetadata([resource], { authorizationServers: [issuer] }));
  api.get('/mcp', requireAuth(auth), requireScopes('notes:read'), (req, res) =>
    res.json({ subject: req.auth.subject, viaLocals: res.locals.auth.subject }),
  );
  api.post('/mcp', requireAuth(auth), requireScopes('notes:write'), (_req, res) => res.json({ ok: true }));
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
    headers: { 'content-type': 'application/json' },
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
  assert.equal(forbidden.headers.get('www-authenticate'), 'Bearer error="insufficient_scope", scope="notes:write"');

  const refreshed = await client.refresh(tokens);
  assert.notEqual(refreshed.accessToken, tokens.accessToken);
  await assert.rejects(client.refresh(tokens), (error) => error instanceof OAuthClientError && error.error === 'invalid_grant');

  assert.equal((await client.introspect(tokens.accessToken)).active, true);
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
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', password: 'nope' }),
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.getSetCookie().length, 0);

  const cookie = await login();
  assert.equal((await fetch(`${issuer}/oauth/session`, { headers: { cookie } })).status, 200);
  const refreshed = await fetch(`${issuer}/oauth/session/refresh`, { method: 'POST', headers: { cookie } });
  assert.equal(refreshed.status, 200);
  const newCookie = refreshed.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const logout = await fetch(`${issuer}/oauth/logout`, { method: 'POST', headers: { cookie: newCookie } });
  assert.match(logout.headers.getSetCookie()[0], /Max-Age=0/);
  assert.equal((await fetch(`${issuer}/oauth/session/refresh`, { method: 'POST', headers: { cookie: newCookie } })).status, 401);
});

test('Hono: the same server and the same checks', async () => {
  const auth = oauth.resourceServer({ audience: exactResource(apiUrl) });
  const app = new Hono();
  app.use('*', authRoutes(oauth));
  app.get('/mcp', bearerAuth(auth), honoRequireScopes('notes:read'), (c) =>
    c.json({ subject: c.get('auth').subject }),
  );
  app.post('/mcp', bearerAuth(auth), honoRequireScopes('notes:write'), (c) => c.json({ ok: true }));
  // Addressed as if it were served at the resource URL
  const request = (path, init) => app.request(`${apiHttp.url}${path}`, init);

  const metadata = await request('/.well-known/oauth-authorization-server');
  assert.equal((await metadata.json()).issuer, issuer);

  const { tokens } = await obtainTokens();
  const headers = { authorization: `Bearer ${tokens.accessToken}` };
  assert.equal((await request('/mcp', { headers })).status, 200);

  const forbidden = await request('/mcp', { method: 'POST', headers });
  assert.equal(forbidden.status, 403);
  assert.match(forbidden.headers.get('www-authenticate'), /insufficient_scope/);

  const missing = await request('/mcp');
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('www-authenticate'), /resource_metadata=/);

  const token = await request('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=nope',
  });
  assert.equal(token.status, 400);
  assert.equal((await token.json()).error, 'unsupported_grant_type');
});
