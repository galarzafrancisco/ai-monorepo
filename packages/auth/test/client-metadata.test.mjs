import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { ClientMetadataDocumentFetcher, OAuthError } from '@taico/auth';
import { createPkcePair } from '@taico/auth/client';
import { createTestServer, ISSUER, NOTES } from './helpers.mjs';

/*
 * Clients that identify themselves with a metadata document URL, and
 * authenticate with a signed assertion (private_key_jwt). The documents are
 * served from loopback, which the fetcher only allows when told to.
 */

let http;
let origin;
let privateKey;
let fetches = 0;
const documents = {};

before(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true });
  privateKey = pair.privateKey;
  const publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' };

  http = createServer((request, response) => {
    fetches += 1;
    const document = documents[request.url];
    if (!document) {
      response.statusCode = 404;
      return response.end();
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(document));
  });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${http.address().port}`;

  const base = { client_name: 'Doc client', redirect_uris: ['http://127.0.0.1:1/cb'] };
  documents['/public.json'] = { ...base, client_id: `${origin}/public.json` };
  documents['/signed.json'] = {
    ...base,
    client_id: `${origin}/signed.json`,
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'private_key_jwt',
    jwks: { keys: [publicJwk] },
  };
  documents['/mismatch.json'] = { ...base, client_id: `${origin}/other.json` };
  documents['/secret.json'] = { ...base, client_id: `${origin}/secret.json`, client_secret: 's' };
  documents['/bad-redirect.json'] = {
    ...base,
    client_id: `${origin}/bad-redirect.json`,
    redirect_uris: ['http://evil.example.com/cb'],
  };
});

after(() => {
  http.close();
  http.closeAllConnections();
});

const create = () => createTestServer({ clientMetadata: { allowInsecureLoopback: true } });

const oauthError = (error) => (thrown) => {
  assert.ok(thrown instanceof OAuthError, `expected OAuthError, got ${thrown}`);
  assert.equal(thrown.error, error);
  return true;
};

async function authorize(server, user, clientId) {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const { grantId } = await server.authorize({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: 'http://127.0.0.1:1/cb',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    resource: NOTES.resourceUrl,
    scope: 'notes:read',
  });
  const { redirectTo } = await server.decide({ grantId, approved: true, subjectId: user.id });
  return {
    grant_type: 'authorization_code',
    code: new URL(redirectTo).searchParams.get('code'),
    code_verifier: codeVerifier,
    redirect_uri: 'http://127.0.0.1:1/cb',
  };
}

const assertion = (clientId, overrides = {}) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(overrides.issuer ?? clientId)
    .setSubject(clientId)
    .setAudience(overrides.audience ?? ISSUER)
    .setExpirationTime('1m')
    .setJti(crypto.randomUUID())
    .sign(overrides.key ?? privateKey);

const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

test('a metadata document URL is not fetched unless loopback is explicitly allowed', async () => {
  const { server } = await createTestServer();
  await assert.rejects(
    server.authorize({ response_type: 'code', client_id: `${origin}/public.json`, redirect_uri: 'http://127.0.0.1:1/cb' }),
    oauthError('invalid_client'),
  );
  const fetcher = new ClientMetadataDocumentFetcher();
  await assert.rejects(fetcher.fetch(new URL(`${origin}/public.json`)), /must use https/);
  await assert.rejects(fetcher.fetch(new URL('https://127.0.0.1/x.json')), /non-public address/);
  await assert.rejects(fetcher.fetch(new URL('https://169.254.169.254/latest')), /non-public address/);
});

test('a public metadata document client completes the flow, and the document is cached', async () => {
  const { server, user } = await create();
  const clientId = `${origin}/public.json`;
  const before = fetches;
  const request = await authorize(server, user, clientId);
  await authorize(server, user, clientId);
  assert.equal(fetches - before, 1, 'the second authorization used the cached document');

  const tokens = await server.token({ ...request, client_id: clientId });
  assert.ok(tokens.access_token);
  assert.equal(tokens.refresh_token, undefined, 'the document did not ask for refresh_token');
});

test('invalid metadata documents are refused', async () => {
  const { server } = await create();
  for (const name of ['mismatch', 'secret', 'bad-redirect', 'missing']) {
    await assert.rejects(
      server.authorize({
        response_type: 'code',
        client_id: `${origin}/${name}.json`,
        redirect_uri: 'http://127.0.0.1:1/cb',
      }),
      oauthError('invalid_client_metadata'),
      name,
    );
  }
  await assert.rejects(
    server.authorize({ response_type: 'code', client_id: `${origin}/a/../public.json`, redirect_uri: 'x' }),
    oauthError('invalid_client_metadata'),
  );
});

test('a private_key_jwt client must prove it holds its key on every token request', async () => {
  const { server, user } = await create();
  const clientId = `${origin}/signed.json`;
  const attempt = async (extra, expected = 'invalid_client') =>
    assert.rejects(server.token({ ...(await authorize(server, user, clientId)), ...extra }), oauthError(expected));

  // Naming the client is not enough
  await attempt({ client_id: clientId });
  await attempt({ client_assertion_type: 'wrong', client_assertion: await assertion(clientId) });
  await attempt({ client_assertion_type: ASSERTION_TYPE, client_assertion: await assertion(clientId, { audience: 'https://other.example.com' }) });
  await attempt({ client_assertion_type: ASSERTION_TYPE, client_assertion: await assertion(clientId, { issuer: 'someone-else' }) });
  const stranger = await generateKeyPair('ES256');
  await attempt({ client_assertion_type: ASSERTION_TYPE, client_assertion: await assertion(clientId, { key: stranger.privateKey }) });

  const tokens = await server.token({
    ...(await authorize(server, user, clientId)),
    client_assertion_type: ASSERTION_TYPE,
    client_assertion: await assertion(clientId, { audience: `${ISSUER}/oauth/token` }),
  });
  assert.ok(tokens.refresh_token);

  // The refresh grant needs the assertion too: a stolen refresh token is useless alone
  await assert.rejects(
    server.token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }),
    oauthError('invalid_client'),
  );
  const refreshed = await server.token({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_assertion_type: ASSERTION_TYPE,
    client_assertion: await assertion(clientId),
  });
  assert.ok(refreshed.access_token);
});
