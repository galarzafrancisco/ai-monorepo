import { rm } from 'node:fs/promises';
import { createAuthorizationServer, sqliteKeyStore, sqliteStorage } from '../src/index.js';
import type { ExpressRequestLike, ExpressResponseLike, Principal } from '../src/index.js';

const sqliteFile = './test-app/auth-server-test.sqlite';
await rm(sqliteFile, { force: true });

const alice: Principal = {
  id: 'user-alice',
  email: 'alice@example.com',
  displayName: 'Alice',
};

const storage = await sqliteStorage({ file: sqliteFile });
const keys = await sqliteKeyStore({ file: sqliteFile });

const auth = await createAuthorizationServer({
  issuer: 'https://auth.example.test',
  storage,
  keys,
  identityProvider: {
    async authenticatePassword({ email, password }) {
      return email === alice.email && password === 'correct-horse-battery-staple' ? alice : null;
    },
    async findPrincipalById(id) {
      return id === alice.id ? alice : null;
    },
  },
  scopes: [
    { id: 'profile:read', description: 'Read profile' },
    { id: 'tasks:read', description: 'Read tasks' },
    { id: 'tasks:write', description: 'Write tasks' },
    { id: 'mcp:use', description: 'Use MCP endpoints' },
  ],
});

const mcp = await auth.registerMcpServer({
  id: 'tasks',
  name: 'Tasks',
  version: '1.0.0',
  resource: 'https://api.example.test/api/tasks/mcp',
  scopes: ['tasks:read', 'tasks:write'],
  requiredScopes: ['mcp:use'],
});

await auth.registerDownstreamConnection({
  id: 'github',
  displayName: 'GitHub',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  mappings: [{ from: 'tasks:write', to: 'repo' }],
  async exchangeToken({ scopes }) {
    return {
      accessToken: 'github-downstream-access-token',
      tokenType: 'Bearer',
      scopes,
      connection: 'github',
    };
  },
});
storage.interactions.set('flow-id', {
  flowId: 'flow-id',
  client: {
    id: 'client-id',
    name: 'Example Client',
    redirectUris: ['https://app.example.test/callback'],
    scopes: ['profile:read'],
  },
  scopes: [{ id: 'profile:read' }],
  loginRequired: false,
  consentRequired: true,
  downstreamConnectionsRequired: [],
});
storage.grants.set('grant-id', { subject: alice.id, clientId: 'client-id', scopes: ['profile:read'] });
await storage.flush();

const issued = await auth.issueToken({
  subject: alice.id,
  principal: alice,
  audience: mcp.resource,
  scopes: ['profile:read', 'tasks:read', 'tasks:write', 'mcp:use'],
});

const context = await auth.validateToken(issued.accessToken, {
  audience: mcp.resource,
  requiredScopes: ['profile:read'],
});
assert(context.principal?.email === alice.email, 'validated token should resolve a principal');

const downstream = await auth.exchangeDownstreamToken({
  subjectToken: issued.accessToken,
  audience: mcp.resource,
  connection: 'github',
  scopes: ['repo'],
});
assert(downstream.connection === 'github', 'downstream exchange should return the requested connection');
assert(downstream.accessToken !== issued.accessToken, 'downstream exchange must not pass through the subject token');

const metadata = await auth.discovery.protectedResourceMetadata(mcp.resource);
assert(metadata.scopes_supported.includes('tasks:read'), 'MCP protected resource metadata should expose server scopes');

const req: ExpressRequestLike = {
  headers: { authorization: `Bearer ${issued.accessToken}` },
};
const res = responseRecorder();
let nextCalled = false;
await auth.express().authenticate({ audience: mcp.resource })(req, res, () => {
  nextCalled = true;
});
assert(nextCalled, 'Express authenticate middleware should call next for valid tokens');
assert(req.auth?.subject === alice.id, 'Express authenticate middleware should attach auth context');

await auth.express().requireScopes('tasks:write')(req, res, () => undefined);

const unauthenticatedReq: ExpressRequestLike = { headers: {} };
const unauthenticatedRes = statusRecorder();
let unauthenticatedNextCalled = false;
await auth.express().requireScopes('tasks:write')(unauthenticatedReq, unauthenticatedRes, () => {
  unauthenticatedNextCalled = true;
});
assert(!unauthenticatedNextCalled, 'Express requireScopes should fail closed without auth context');
assert(unauthenticatedRes.statusCode === 401, 'Express requireScopes should return 401 without auth context');

await storage.close();
await keys.close();

const reopenedStorage = await sqliteStorage({ file: sqliteFile });
const reopenedKeys = await sqliteKeyStore({ file: sqliteFile });
const restartedAuth = await createAuthorizationServer({
  issuer: 'https://auth.example.test',
  storage: reopenedStorage,
  keys: reopenedKeys,
  identityProvider: {
    async findPrincipalById(id) {
      return id === alice.id ? alice : null;
    },
  },
});

const restartedContext = await restartedAuth.validateToken(issued.accessToken, { audience: mcp.resource });
assert(restartedContext.subject === alice.id, 'SQLite key store should validate tokens after restart');
assert(
  reopenedStorage.downstreamConnections.get('github')?.clientId === 'client-id',
  'SQLite storage should persist downstream connection metadata',
);
assert(reopenedStorage.interactions.get('flow-id')?.client.id === 'client-id', 'SQLite storage should persist auth flows');
assert(
  (reopenedStorage.grants.get('grant-id') as { subject?: string } | undefined)?.subject === alice.id,
  'SQLite storage should persist grants',
);

reopenedStorage.clients.set('client-id', {
  id: 'client-id',
  name: 'Example Client',
  redirectUris: ['https://app.example.test/callback'],
  scopes: ['profile:read'],
});
await reopenedStorage.flush();

const clientStorage = await sqliteStorage({ file: sqliteFile });
assert(clientStorage.clients.get('client-id')?.name === 'Example Client', 'SQLite storage should persist auth clients');
await clientStorage.close();

await reopenedStorage.close();
await reopenedKeys.close();
await rm(sqliteFile, { force: true });

console.log('authorization-server test app passed');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function responseRecorder(): ExpressResponseLike {
  return {
    status() {
      return this;
    },
    json(body: unknown) {
      throw new Error(`unexpected response: ${JSON.stringify(body)}`);
    },
  };
}

function statusRecorder(): ExpressResponseLike & { statusCode?: number; body?: unknown } {
  return {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
  };
}
