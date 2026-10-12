import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anyAudience,
  buildChallenge,
  exactResource,
  formatScope,
  hasScopes,
  InsufficientScopeError,
  InvalidAccessTokenError,
  KeyManager,
  literalAudience,
  MissingAccessTokenError,
  parseCookies,
  parseScope,
  remoteJwks,
  requestUrlAudience,
  ResourceServer,
  TokenExpiredError,
  TokenRevokedError,
  TokenSigner,
  TokenValidationError,
  TokenVerifier,
  InvalidTokenSignatureError,
} from '@taico/auth';
import { MemoryIssuedTokenStore, MemoryKeyStore } from '@taico/auth/memory';
import { ISSUER, testClock } from './helpers.mjs';

function setup(clock = testClock()) {
  const store = new MemoryKeyStore();
  const calls = { findActive: 0, listVerifiable: 0 };
  for (const method of Object.keys(calls)) {
    const original = store[method].bind(store);
    store[method] = (...args) => {
      calls[method] += 1;
      return original(...args);
    };
  }
  const keys = new KeyManager({ store, clock, signingTtlHours: 1, verifyingTtlHours: 1 });
  const signer = new TokenSigner(keys, ISSUER, clock);
  const revocation = new MemoryIssuedTokenStore();
  const verifier = new TokenVerifier({ issuer: ISSUER, jwks: keys, revocation });
  return { store, calls, keys, signer, verifier, revocation, clock };
}

const issue = (signer, extra = {}) =>
  signer.issue({
    subject: 'user-1',
    audience: ISSUER,
    scopes: ['a', 'b'],
    clientId: 'client-1',
    ttlSeconds: 60,
    ...extra,
  });

test('scopes are read from a string or a legacy array, and written as a string', () => {
  assert.deepEqual(parseScope('a  b a'), ['a', 'b']);
  assert.deepEqual(parseScope(['a', '', 'b', 7]), ['a', 'b']);
  assert.deepEqual(parseScope(undefined), []);
  assert.equal(formatScope(['a', 'b']), 'a b');
  assert.equal(hasScopes(['a'], ['a', 'b']), false);
  assert.equal(hasScopes(['a'], ['a', 'b'], 'any'), true);
  assert.equal(hasScopes([], []), true);
});

test('audience policies', () => {
  const resource = exactResource('https://api.example.com/mcp');
  assert.equal(resource.accepts(['https://api.example.com/mcp/'], ''), true);
  assert.equal(resource.accepts(['https://api.example.com/other'], ''), false);
  assert.equal(resource.accepts([], ''), false);

  const perUrl = requestUrlAudience();
  assert.equal(perUrl.accepts(['https://x/a'], 'https://x/a/'), true);
  // Not parsed: dot segments must not be resolved into a match
  assert.equal(perUrl.accepts(['https://x/a'], 'https://x/b/../a'), false);

  const either = anyAudience(literalAudience('first-party'), perUrl);
  assert.equal(either.accepts(['first-party'], 'https://x/anything'), true);
  assert.equal(either.accepts(['https://x/a'], 'https://x/b'), false);
});

test('challenges follow RFC 6750', () => {
  assert.deepEqual(buildChallenge(new MissingAccessTokenError(), { resourceMetadataUrl: 'https://x/m' }), {
    status: 401,
    header: 'Bearer resource_metadata="https://x/m"',
  });
  const invalid = buildChallenge(new InvalidAccessTokenError('nope'));
  assert.equal(invalid.status, 401);
  assert.match(invalid.header, /^Bearer error="invalid_token"/);
  assert.deepEqual(buildChallenge(new InsufficientScopeError(['a', 'b'])), {
    status: 403,
    header: 'Bearer error="insufficient_scope", scope="a b"',
  });
  assert.equal(buildChallenge({ code: 'SOMETHING_ELSE' }), null);
});

test('cookies are parsed without letting a duplicate override the first', () => {
  assert.deepEqual(parseCookies('a=1; b=hello%20world; a=2'), { a: '1', b: 'hello world' });
  assert.deepEqual(parseCookies(undefined), {});
});

test('a signed token verifies and carries a space-delimited scope', async () => {
  const { signer, verifier } = setup();
  const { token, jti } = await issue(signer, { claims: { role: 'admin', sub: 'ignored' } });
  const claims = await verifier.verify(token);
  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.scope, 'a b');
  assert.equal(claims.role, 'admin');
  assert.equal(claims.jti, jti);
  assert.equal(claims.iss, ISSUER);
});

test('keys are cached: signing and verifying do not query the store per token', async () => {
  const { signer, verifier, calls } = setup();
  for (let i = 0; i < 5; i += 1) {
    await verifier.verify((await issue(signer)).token);
  }
  assert.equal(calls.findActive, 1);
  assert.equal(calls.listVerifiable, 1);
});

test('verification failures are told apart', async () => {
  const clock = testClock();
  const { signer, verifier } = setup(clock);
  const { token } = await issue(signer);

  const [header, payload, signature] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: 'someone-else' }),
  ).toString('base64url');
  await assert.rejects(verifier.verify(`${header}.${forged}.${signature}`), InvalidTokenSignatureError);
  await assert.rejects(verifier.verify('not-a-token'), TokenValidationError);

  const other = new TokenVerifier({ issuer: 'https://other.example.com', jwks: setup().keys });
  await assert.rejects(other.verify(token), TokenValidationError);

  const expired = await issue(signer, { ttlSeconds: 1 });
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await assert.rejects(verifier.verify(expired.token), TokenExpiredError);
});

test('a revoked token stops verifying immediately', async () => {
  const { signer, verifier, revocation } = setup();
  const { token, jti } = await issue(signer);
  await verifier.verify(token);
  await revocation.revoke(jti);
  await assert.rejects(verifier.verify(token), TokenRevokedError);
});

test('a token signed with a rotated key still verifies; a new key is picked up', async () => {
  const { keys, signer, verifier } = setup();
  const before = await issue(signer);
  await verifier.verify(before.token);
  await keys.rotate();
  const after = await issue(signer);
  assert.notEqual(
    JSON.parse(Buffer.from(before.token.split('.')[0], 'base64url')).kid,
    JSON.parse(Buffer.from(after.token.split('.')[0], 'base64url')).kid,
  );
  await verifier.verify(before.token);
  await verifier.verify(after.token);
});

test('a key past its verifying window no longer verifies', async () => {
  const clock = testClock();
  const { signer, verifier } = setup(clock);
  const { token } = await issue(signer, { ttlSeconds: 4 * 3600 });
  clock.advance(2 * 3600_000 + 120_000);
  await assert.rejects(verifier.verify(token), /Key not found/);
});

test('remoteJwks caches, and refetches for an unknown key only after the cooldown', async () => {
  const { keys, signer } = setup();
  const first = await issue(signer);
  const beforeRotation = await keys.getJwks();
  await keys.rotate();
  const rotated = await issue(signer);
  const afterRotation = await keys.getJwks();

  let served = beforeRotation;
  let fetches = 0;
  const jwks = remoteJwks('https://auth.example.com/.well-known/jwks.json', {
    cooldownMs: 300,
    fetch: async () => {
      fetches += 1;
      return new Response(JSON.stringify(served));
    },
  });
  const verifier = new TokenVerifier({ issuer: ISSUER, jwks });
  await verifier.verify(first.token);
  await verifier.verify(first.token);
  assert.equal(fetches, 1);

  served = afterRotation;
  await assert.rejects(verifier.verify(rotated.token), /Key not found/);
  assert.equal(fetches, 1, 'no refetch inside the cooldown');
  await new Promise((resolve) => setTimeout(resolve, 350));
  await verifier.verify(rotated.token);
  assert.equal(fetches, 2);
});

test('ResourceServer checks the audience and reports errors as AuthErrors', async () => {
  const { signer, verifier } = setup();
  const resource = 'https://notes.example.com/mcp';
  const auth = new ResourceServer({ verifier, audience: exactResource(resource), cookieName: 'access_token' });

  const good = await issue(signer, { audience: resource });
  const context = await auth.authenticate({ authorization: `Bearer ${good.token}` }, resource);
  assert.deepEqual(context.scopes, ['a', 'b']);
  assert.equal(context.subject, 'user-1');

  const viaCookie = await auth.authenticate({ cookie: `access_token=${good.token}` }, resource);
  assert.equal(viaCookie.subject, 'user-1');

  await assert.rejects(auth.authenticate({}, resource), MissingAccessTokenError);
  await assert.rejects(auth.authenticate({ authorization: 'Basic abc' }, resource), MissingAccessTokenError);
  const elsewhere = await issue(signer, { audience: 'https://other.example.com/mcp' });
  await assert.rejects(
    auth.authenticate({ authorization: `Bearer ${elsewhere.token}` }, resource),
    /not issued for this resource/,
  );

  auth.requireScopes(context, { scopes: ['a'], mode: 'all' });
  assert.throws(() => auth.requireScopes(context, { scopes: ['z'], mode: 'all' }), InsufficientScopeError);
  assert.throws(() => auth.requireScopes(undefined, { scopes: ['a'], mode: 'all' }), InvalidAccessTokenError);
});

test('legacy array-form scope claims are still understood', async () => {
  const { signer, verifier } = setup();
  const now = Math.floor(Date.now() / 1000);
  const token = await signer.sign({
    iss: ISSUER, sub: 'u', aud: ISSUER, iat: now, exp: now + 60, jti: 'j', client_id: 'c',
    scope: ['a', 'b'],
  });
  const auth = new ResourceServer({ verifier, audience: literalAudience(ISSUER) });
  assert.deepEqual((await auth.authenticateToken(token, ISSUER)).scopes, ['a', 'b']);
});
