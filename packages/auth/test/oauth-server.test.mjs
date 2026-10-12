import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exactResource, InvalidCredentialsError, OAuthError, parseScope } from '@taico/auth';
import { createPkcePair } from '@taico/auth/client';
import { authorizeClient, createTestServer, ISSUER, NOTES, testClock, tokenRequest } from './helpers.mjs';

const oauthError = (error) => (thrown) => {
  assert.ok(thrown instanceof OAuthError, `expected OAuthError, got ${thrown}`);
  assert.equal(thrown.error, error);
  return true;
};

test('authorization code flow issues a token bound to the resource', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);

  const redirect = new URL(flow.redirectTo);
  assert.equal(redirect.searchParams.get('state'), 'xyz');
  assert.equal(redirect.searchParams.get('iss'), ISSUER);

  const tokens = await server.token(tokenRequest(flow));
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.scope, 'notes:read', 'unknown scopes are dropped');
  assert.ok(tokens.refresh_token);

  const auth = server.resourceServer({ audience: exactResource(NOTES.resourceUrl) });
  const context = await auth.authenticateToken(tokens.access_token, NOTES.resourceUrl);
  assert.equal(context.subject, user.id);
  assert.equal(context.claims.aud, NOTES.resourceUrl);
  assert.equal(context.claims.email, 'ada@example.com');
  assert.equal(context.claims.role, 'admin', 'ClaimsProvider claims are included');
  assert.equal(context.claims.client_id, flow.client.clientId);

  // The same token is not good for the host's own API
  await assert.rejects(server.resourceServer().authenticateToken(tokens.access_token, ISSUER));
});

test('authorize rejects bad requests before anything is stored', async () => {
  const { server } = await createTestServer();
  const client = await server.register({
    client_name: 'c',
    redirect_uris: ['http://127.0.0.1:1/cb'],
  });
  const base = {
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: 'http://127.0.0.1:1/cb',
    code_challenge: createPkcePair().codeChallenge,
    code_challenge_method: 'S256',
    resource: NOTES.resourceUrl,
  };
  await assert.rejects(server.authorize({ ...base, response_type: 'token' }), oauthError('unsupported_response_type'));
  await assert.rejects(server.authorize({ ...base, client_id: 'nope' }), oauthError('invalid_client'));
  await assert.rejects(server.authorize({ ...base, redirect_uri: 'https://evil.example.com/cb' }), oauthError('invalid_request'));
  await assert.rejects(server.authorize({ ...base, code_challenge: undefined }), oauthError('invalid_request'));
  await assert.rejects(server.authorize({ ...base, code_challenge_method: 'plain' }), oauthError('invalid_request'));
  await assert.rejects(server.authorize({ ...base, resource: 'https://unknown.example.com' }), oauthError('invalid_target'));
  await assert.rejects(server.authorize({ ...base, resource: undefined }), oauthError('invalid_target'));
  // Loopback redirect URIs may use any port (RFC 8252)
  await server.authorize({ ...base, redirect_uri: 'http://127.0.0.1:54321/cb' });
});

test('registration only accepts public clients with usable redirect URIs', async () => {
  const { server } = await createTestServer();
  await assert.rejects(server.register({ redirect_uris: ['https://a/cb'] }), oauthError('invalid_client_metadata'));
  await assert.rejects(server.register({ client_name: 'c', redirect_uris: [] }), oauthError('invalid_redirect_uri'));
  await assert.rejects(server.register({ client_name: 'c', redirect_uris: ['javascript:alert(1)'] }), oauthError('invalid_redirect_uri'));
  await assert.rejects(
    server.register({ client_name: 'c', redirect_uris: ['https://a/cb'], token_endpoint_auth_method: 'client_secret_basic' }),
    oauthError('invalid_client_metadata'),
  );
  const client = await server.register({ client_name: 'c', redirect_uris: ['cursor://callback'] });
  assert.equal(client.tokenEndpointAuthMethod, 'none');
});

test('the token endpoint enforces PKCE, redirect URI, client and resource binding', async () => {
  const { server, user } = await createTestServer();
  const attempt = async (extra) => {
    const flow = await authorizeClient(server, user);
    return assert.rejects(server.token(tokenRequest(flow, extra)), oauthError(extra.expect ?? 'invalid_grant'));
  };
  await attempt({ code_verifier: 'wrong-verifier' });
  await attempt({ redirect_uri: 'http://127.0.0.1:7777/other' });
  await attempt({ client_id: 'someone-else' });
  await attempt({ code: 'made-up' });
  await attempt({ resource: 'https://other.example.com/mcp', expect: 'invalid_target' });
  await attempt({ client_id: undefined, expect: 'invalid_request' });
  await assert.rejects(server.token({ grant_type: 'password' }), oauthError('unsupported_grant_type'));
});

test('an authorization code works once; replaying it revokes what it produced', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);
  const tokens = await server.token(tokenRequest(flow));
  await assert.rejects(server.token(tokenRequest(flow)), oauthError('invalid_grant'));
  await assert.rejects(
    server.token({ grant_type: 'refresh_token', client_id: flow.client.clientId, refresh_token: tokens.refresh_token }),
    oauthError('invalid_grant'),
  );
});

test('two racing redemptions of one code yield exactly one token', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);
  const results = await Promise.allSettled([
    server.token(tokenRequest(flow)),
    server.token(tokenRequest(flow)),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
});

test('an expired authorization code is refused', async () => {
  const clock = testClock();
  const { server, user } = await createTestServer({ clock });
  const flow = await authorizeClient(server, user);
  clock.advance(11 * 60_000);
  await assert.rejects(server.token(tokenRequest(flow)), oauthError('invalid_grant'));
});

test('refresh tokens rotate, and reuse of an old one revokes the grant', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);
  const first = await server.token(tokenRequest(flow));
  const refresh = (refresh_token) =>
    server.token({ grant_type: 'refresh_token', client_id: flow.client.clientId, refresh_token });

  const second = await refresh(first.refresh_token);
  assert.notEqual(second.refresh_token, first.refresh_token);
  assert.equal(second.scope, 'notes:read');

  // The first token was rotated away: presenting it again is a theft signal
  await assert.rejects(refresh(first.refresh_token), oauthError('invalid_grant'));
  await assert.rejects(refresh(second.refresh_token), oauthError('invalid_grant'));
});

test('a refresh token is bound to its client', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);
  const tokens = await server.token(tokenRequest(flow));
  await assert.rejects(
    server.token({ grant_type: 'refresh_token', client_id: 'other', refresh_token: tokens.refresh_token }),
    oauthError('invalid_grant'),
  );
  // The failed attempt did not burn the token
  await server.token({ grant_type: 'refresh_token', client_id: flow.client.clientId, refresh_token: tokens.refresh_token });
});

test('denying consent redirects with access_denied and issues no code', async () => {
  const { server, user } = await createTestServer();
  const client = await server.register({ client_name: 'c', redirect_uris: ['https://app.example.com/cb'] });
  const { grantId } = await server.authorize({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: 'https://app.example.com/cb',
    code_challenge: createPkcePair().codeChallenge,
    code_challenge_method: 'S256',
    resource: 'notes',
    state: 's',
  });
  const consent = await server.getConsent(grantId);
  assert.equal(consent.client.clientName, 'c');
  assert.equal(consent.resource.name, 'Notes');

  const { redirectTo } = await server.decide({ grantId, approved: false, subjectId: user.id });
  const url = new URL(redirectTo);
  assert.equal(url.searchParams.get('error'), 'access_denied');
  assert.equal(url.searchParams.get('state'), 's');
  assert.equal(url.searchParams.get('code'), null);
  await assert.rejects(server.decide({ grantId, approved: true, subjectId: user.id }), oauthError('invalid_request'));
});

test('the afterConsent hook can detour the user before the code is issued', async () => {
  const seen = [];
  const { server, user } = await createTestServer({
    hooks: {
      afterConsent: async (grant) => {
        seen.push(grant.id);
        return { redirectTo: `https://downstream.example.com/connect?grant=${grant.id}` };
      },
    },
  });
  const flow = await authorizeClient(server, user);
  assert.equal(flow.code, null);
  assert.match(flow.redirectTo, /^https:\/\/downstream\.example\.com\/connect/);
  assert.deepEqual(seen, [flow.grantId]);

  // The host resumes once its own steps are done
  const { redirectTo } = await server.completeAuthorization(flow.grantId);
  const code = new URL(redirectTo).searchParams.get('code');
  const tokens = await server.token(tokenRequest({ ...flow, code }));
  assert.ok(tokens.access_token);
  await assert.rejects(server.completeAuthorization(flow.grantId), oauthError('invalid_request'));
});

test('introspection reports active tokens only, with a string scope', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);
  const tokens = await server.token(tokenRequest(flow));
  const result = await server.introspect({ token: tokens.access_token });
  assert.equal(result.active, true);
  assert.equal(result.scope, 'notes:read');
  assert.equal(result.sub, user.id);
  assert.deepEqual(await server.introspect({ token: tokens.access_token, client_id: 'other' }), { active: false });
  assert.deepEqual(await server.introspect({ token: 'garbage' }), { active: false });
  assert.deepEqual(await server.introspect({}), { active: false });
});

test('revoking a refresh token ends its grant; revoking an access token kills it at once', async () => {
  const { server, user } = await createTestServer();
  const flow = await authorizeClient(server, user);
  const tokens = await server.token(tokenRequest(flow));

  await server.revoke({ token: tokens.access_token });
  assert.deepEqual(await server.introspect({ token: tokens.access_token }), { active: false });

  await server.revoke({ token: tokens.refresh_token });
  await assert.rejects(
    server.token({ grant_type: 'refresh_token', client_id: flow.client.clientId, refresh_token: tokens.refresh_token }),
    oauthError('invalid_grant'),
  );
  await server.revoke({ token: 'unknown' });
});

test('a directly issued token can be listed and revoked, and revocation is enforced', async () => {
  const { server, stores, user } = await createTestServer();
  const issued = await server.issueToken({
    subject: user.id,
    scopes: ['notes:read'],
    ttlSeconds: 365 * 24 * 3600,
    record: { name: 'CI token', issuedBy: user.id },
  });
  const auth = server.resourceServer();
  const context = await auth.authenticateToken(issued.token, ISSUER);
  assert.equal(context.claims.issued_by, user.id);
  assert.deepEqual(parseScope(context.claims.scope), ['notes:read']);
  assert.equal((await stores.issuedTokens.listBySubject(user.id))[0].name, 'CI token');

  await server.revokeIssuedToken(issued.jti);
  await assert.rejects(auth.authenticateToken(issued.token, ISSUER), /Token revoked/);
});

test('sessions: login, refresh rotation with reuse detection, logout', async () => {
  const { server, user } = await createTestServer();
  await assert.rejects(server.login({ email: 'ada@example.com', password: 'wrong' }), InvalidCredentialsError);
  await assert.rejects(server.login({ email: 'nobody@example.com', password: 'x' }), InvalidCredentialsError);

  const session = await server.login({ email: 'ADA@example.com', password: 'correct horse' });
  assert.equal(await server.resolveSession(session.accessToken), user.id);

  const next = await server.refreshSession(session.refreshToken);
  assert.notEqual(next.refreshToken, session.refreshToken);
  // Reusing the rotated token ends every session of the user
  await assert.rejects(server.refreshSession(session.refreshToken), /revoked/);
  await assert.rejects(server.refreshSession(next.refreshToken), /revoked/);

  const again = await server.login({ email: 'ada@example.com', password: 'correct horse' });
  await server.logout(again.refreshToken);
  await assert.rejects(server.refreshSession(again.refreshToken), /revoked/);
});

test('a client or agent token cannot be replayed as a browser session', async () => {
  const { server, user } = await createTestServer();
  const issued = await server.issueToken({ subject: user.id, scopes: [], ttlSeconds: 60 });
  await assert.rejects(server.resolveSession(issued.token), /not a session token/);
  const flow = await authorizeClient(server, user);
  const tokens = await server.token(tokenRequest(flow));
  await assert.rejects(server.resolveSession(tokens.access_token), /not a session token/);
});

test('metadata advertises the endpoints and PKCE S256 only', async () => {
  const { server } = await createTestServer();
  const metadata = server.metadata();
  assert.equal(metadata.issuer, ISSUER);
  assert.equal(metadata.token_endpoint, `${ISSUER}/oauth/token`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
  assert.deepEqual(metadata.scopes_supported, ['notes:read', 'notes:write']);
  assert.deepEqual(await server.protectedResourceMetadata('/mcp'), {
    resource: NOTES.resourceUrl,
    authorization_servers: [ISSUER],
    scopes_supported: ['notes:read', 'notes:write'],
    bearer_methods_supported: ['header'],
    resource_name: 'Notes',
  });
  assert.equal(await server.protectedResourceMetadata('/nope'), null);
});
