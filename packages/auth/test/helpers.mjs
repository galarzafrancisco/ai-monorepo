import { OAuthServer, ScopeRegistry } from '@taico/auth';
import { localIdp } from '@taico/auth/idp-local';
import { MemoryUserStore, memoryStores, staticResources } from '@taico/auth/memory';
import { createPkcePair } from '@taico/auth/client';

export const ISSUER = 'https://auth.example.com';
export const NOTES = {
  id: 'res-1',
  identifier: 'notes',
  resourceUrl: 'https://notes.example.com/mcp',
  name: 'Notes',
  scopes: [
    { id: 'notes:read', description: 'Read notes' },
    { id: 'notes:write', description: 'Write notes' },
  ],
};

/** A clock tests can move */
export function testClock(start = Date.now()) {
  let now = start;
  return {
    now: () => new Date(now),
    advance(ms) {
      now += ms;
    },
  };
}

export async function createTestServer(overrides = {}) {
  const stores = overrides.stores ?? memoryStores();
  const identity = localIdp(overrides.users ?? new MemoryUserStore());
  const user = await identity.createUser({
    email: overrides.email ?? 'Ada@Example.com',
    password: 'correct horse',
    displayName: 'Ada',
    attributes: { role: 'admin' },
  });
  const server = new OAuthServer({
    config: { issuer: ISSUER, ...overrides.config },
    stores,
    resources: staticResources([NOTES]),
    identity,
    scopes: new ScopeRegistry(NOTES.scopes),
    claims: { claimsFor: async (subject) => ({ role: subject.role }) },
    hooks: overrides.hooks,
    clientMetadata: overrides.clientMetadata,
    clock: overrides.clock,
  });
  return { server, stores, identity, user };
}

/** Runs register → authorize → approve, and returns everything needed to redeem the code */
export async function authorizeClient(server, user, options = {}) {
  const redirectUri = 'http://127.0.0.1:7777/callback';
  const client = await server.register({
    client_name: 'Test client',
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
  });
  const { codeVerifier, codeChallenge } = createPkcePair();
  const { grantId } = await server.authorize({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: redirectUri,
    scope: options.scope ?? 'notes:read unknown:scope',
    state: 'xyz',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    resource: NOTES.resourceUrl,
  });
  const { redirectTo } = await server.decide({
    grantId,
    approved: true,
    subjectId: user.id,
  });
  const code = new URL(redirectTo).searchParams.get('code');
  return { client, redirectUri, codeVerifier, grantId, redirectTo, code };
}

export function tokenRequest(flow, extra = {}) {
  return {
    grant_type: 'authorization_code',
    client_id: flow.client.clientId,
    code: flow.code,
    code_verifier: flow.codeVerifier,
    redirect_uri: flow.redirectUri,
    ...extra,
  };
}

/**
 * Wraps a refresh-token store so that `find` only returns once `parties`
 * callers are waiting on it. Racing requests are then guaranteed to all read
 * the token as live before any of them consumes it, which is the interleaving
 * a real race needs and a plain `Promise.all` only produces by luck.
 */
export function racingRefreshTokens(inner, parties = 2) {
  let armed = false;
  let waiting = [];
  const store = Object.create(inner);
  store.find = async (tokenHash) => {
    const found = await inner.find(tokenHash);
    if (!armed) return found;
    await new Promise((resolve) => {
      waiting.push(resolve);
      if (waiting.length === parties) {
        armed = false;
        waiting.forEach((release) => release());
        waiting = [];
      }
    });
    return found;
  };
  return {
    store,
    /** The next `parties` lookups are held until all of them have arrived */
    arm() {
      armed = true;
    },
  };
}

/**
 * The reviewer's scenario for both refresh flows: a thief and the legitimate
 * client present the same refresh token at the same moment. One of them wins
 * the rotation; what it received must not stay usable.
 */
export async function assertConcurrentReuseRevokes({ arm, present, stillWorks }) {
  arm();
  const results = await Promise.allSettled([present(), present()]);
  const winners = results.filter((result) => result.status === 'fulfilled');
  if (winners.length !== 1) {
    throw new Error(`expected exactly one winner, got ${winners.length}`);
  }
  let usable = true;
  try {
    await stillWorks(winners[0].value);
  } catch {
    usable = false;
  }
  if (usable) {
    throw new Error('the rotated credentials survived a concurrent reuse of the old token');
  }
}
