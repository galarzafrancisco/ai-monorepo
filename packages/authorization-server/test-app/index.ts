import { createAuthorizationServer, memoryKeyStore, memoryStorage } from '../src/index.js';
import type { ExpressRequestLike, ExpressResponseLike, Principal } from '../src/index.js';

const alice: Principal = {
  id: 'user-alice',
  email: 'alice@example.com',
  displayName: 'Alice',
};

const auth = await createAuthorizationServer({
  issuer: 'https://auth.example.test',
  storage: memoryStorage(),
  keys: await memoryKeyStore(),
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
});

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
