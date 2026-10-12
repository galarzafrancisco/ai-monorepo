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
 * Wraps a store so a test decides how two requests racing on one single-use
 * credential interleave, instead of leaving it to scheduling.
 *
 * - `read` (the lookup) only returns once both requests are waiting on it, so
 *   both see the credential as unused.
 * - `write` (the atomic single use: `consume`, `redeemCode`) holds one of the
 *   two after it has run: the winner or the loser, as armed.
 */
export function raceControl(inner, { read, write }) {
  let race = null;
  const store = Object.create(inner);
  store[read] = async (...args) => {
    const found = await inner[read](...args);
    const current = race;
    if (!current || current.readers === 2) return found;
    current.readers += 1;
    if (current.readers === 2) current.bothRead();
    await current.whenBothRead;
    return found;
  };
  store[write] = async (...args) => {
    const won = await inner[write](...args);
    const current = race;
    if (current && !current.held && won === current.holdWinner) {
      current.held = true;
      await current.whenReleased;
    }
    return won;
  };
  return {
    store,
    /** Arms the next race. Returns the function that lets the held request go. */
    arm(hold) {
      let bothRead;
      let release;
      race = {
        readers: 0,
        held: false,
        holdWinner: hold === 'winner',
        whenBothRead: new Promise((resolve) => (bothRead = resolve)),
        whenReleased: new Promise((resolve) => (release = resolve)),
      };
      race.bothRead = bothRead;
      return () => {
        race = null;
        release();
      };
    },
  };
}

/**
 * Presents one credential twice at the same moment and returns what the
 * requests that succeeded were given.
 *
 * `first` is what happens first: `'revocation'` holds the winner until the
 * loser has detected the reuse and revoked everything; `'response'` holds the
 * loser until the winner has its tokens in hand.
 */
export async function race({ control, first, present }) {
  const release = control.arm(first === 'revocation' ? 'winner' : 'loser');
  const requests = [present(), present()];
  await Promise.race(requests.map((request) => request.catch(() => {})));
  release();
  const results = await Promise.allSettled(requests);
  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}
