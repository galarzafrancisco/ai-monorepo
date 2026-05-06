import { rm } from 'node:fs/promises';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { createAuthorizationServer, sqliteKeyStore, sqliteStorage } from '../src/index.js';
import { AccessTokenGuard, AuthorizationServerModule, createNestAdapter, CurrentPrincipal, RequireScopes, ScopesGuard } from '../src/nest.js';
import type { AuthorizationServerOptions, ExpressRequestLike, ExpressResponseLike, Principal } from '../src/index.js';

const sqliteFile = './test-app/auth-server-test.sqlite';
await rm(sqliteFile, { force: true });

const alice: Principal = {
  id: 'user-alice',
  email: 'alice@example.com',
  displayName: 'Alice',
};

const storage = await sqliteStorage({ file: sqliteFile });
const keys = await sqliteKeyStore({ file: sqliteFile });

const authOptions: AuthorizationServerOptions = {
  issuer: 'https://auth.example.test',
  basePath: '/auth',
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
};
const auth = await createAuthorizationServer(authOptions);

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

const routeAdapter = auth.express().routes();
const metadataRes = statusRecorder();
await routeAdapter(
  { method: 'GET', path: '/.well-known/oauth-authorization-server' },
  metadataRes,
  unexpectedNext,
);
assert(
  (metadataRes.body as { authorization_endpoint?: string }).authorization_endpoint === 'https://auth.example.test/auth/authorize',
  'Express routes should expose root well-known metadata that points to basePath OAuth endpoints',
);

const jwksRes = statusRecorder();
await routeAdapter({ method: 'GET', path: '/.well-known/jwks.json' }, jwksRes, unexpectedNext);
assert(Array.isArray((jwksRes.body as { keys?: unknown[] }).keys), 'Express routes should expose root JWKS metadata');

const registrationRes = statusRecorder();
await routeAdapter(
  {
    method: 'POST',
    path: '/auth/clients/register',
    body: {
      client_name: 'Runtime Client',
      redirect_uris: ['https://app.example.test/callback'],
      scope: 'profile:read tasks:read',
    },
  },
  registrationRes,
  unexpectedNext,
);
assert(registrationRes.statusCode === 201, 'Express routes should support dynamic client registration');
const registeredClientId = (registrationRes.body as { client_id?: string }).client_id;
assert(typeof registeredClientId === 'string', 'dynamic client registration should return a client id');

const loginRes = statusRecorder();
await routeAdapter(
  {
    method: 'POST',
    path: '/auth/login',
    body: { email: alice.email, password: 'correct-horse-battery-staple' },
  },
  loginRes,
  unexpectedNext,
);
const loginToken = (loginRes.body as { accessToken?: string }).accessToken;
assert(typeof loginToken === 'string', 'Express routes should issue a cookie-capable login token');

const sessionRes = statusRecorder();
await routeAdapter(
  { method: 'GET', path: '/auth/session', headers: { authorization: `Bearer ${loginToken}` } },
  sessionRes,
  unexpectedNext,
);
assert((sessionRes.body as { authenticated?: boolean }).authenticated, 'Express routes should expose authenticated session state');

const authorizeRes = statusRecorder();
await routeAdapter(
  {
    method: 'GET',
    path: '/auth/authorize',
    query: {
      client_id: registeredClientId,
      redirect_uri: 'https://app.example.test/callback',
      scope: 'profile:read',
      state: 'state-value',
      resource: mcp.resource,
    },
    headers: { authorization: `Bearer ${loginToken}` },
  },
  authorizeRes,
  unexpectedNext,
);
const flowId = (authorizeRes.body as { interaction?: { flowId?: string } }).interaction?.flowId;
assert(typeof flowId === 'string', 'Express routes should create authorization interactions');
assert(
  (authorizeRes.body as { login_url?: string; consent_url?: string }).login_url === `/auth/login?flow=${flowId}`,
  'Express authorize route should return basePath-aware login URLs',
);

const approveRes = statusRecorder();
await routeAdapter(
  { method: 'POST', path: `/auth/consent/${flowId}/approve`, headers: { authorization: `Bearer ${loginToken}` } },
  approveRes,
  unexpectedNext,
);
const authorizationCode = (approveRes.body as { code?: string; state?: string }).code;
assert(typeof authorizationCode === 'string', 'Express consent route should approve and issue an authorization code');
assert((approveRes.body as { state?: string }).state === 'state-value', 'Express consent route should preserve OAuth state');

const tokenRes = statusRecorder();
await routeAdapter(
  {
    method: 'POST',
    path: '/auth/token',
    body: {
      grant_type: 'authorization_code',
      code: authorizationCode,
      client_id: registeredClientId,
      redirect_uri: 'https://app.example.test/callback',
    },
  },
  tokenRes,
  unexpectedNext,
);
const routeIssuedToken = (tokenRes.body as { accessToken?: string }).accessToken;
assert(typeof routeIssuedToken === 'string', 'Express token route should exchange authorization codes');

const introspectRes = statusRecorder();
await routeAdapter(
  { method: 'POST', path: '/auth/introspect', body: { token: routeIssuedToken } },
  introspectRes,
  unexpectedNext,
);
assert((introspectRes.body as { active?: boolean }).active, 'Express introspection route should report active tokens');

const exchangeRes = statusRecorder();
await routeAdapter(
  {
    method: 'POST',
    path: '/auth/token-exchange',
    body: { subject_token: issued.accessToken, audience: mcp.resource, connection: 'github', scope: 'repo' },
  },
  exchangeRes,
  unexpectedNext,
);
assert((exchangeRes.body as { connection?: string }).connection === 'github', 'Express token-exchange route should call downstream exchange');

class NestController {
  list() {
    return undefined;
  }
}
RequireScopes('tasks:write')(NestController.prototype, 'list', Object.getOwnPropertyDescriptor(NestController.prototype, 'list'));
const nestRequest: ExpressRequestLike = { headers: { authorization: `Bearer ${issued.accessToken}` } };
const nestContext = {
  getHandler: () => NestController.prototype.list,
  getClass: () => NestController,
  switchToHttp: () => ({ getRequest: () => nestRequest }),
};
const nest = createNestAdapter(auth);
assert(await nest.accessTokenGuard({ audience: mcp.resource }).canActivate(nestContext), 'Nest access token guard should validate bearer tokens');
assert(nest.scopesGuard().canActivate(nestContext), 'Nest scopes guard should enforce RequireScopes metadata');

class NestParamController {
  show(_principal: Principal) {
    return undefined;
  }
}
CurrentPrincipal()(NestParamController.prototype, 'show', 0);
const paramMetadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, NestParamController, 'show') as Record<string, unknown> | undefined;
assert(paramMetadata && Object.keys(paramMetadata).length > 0, 'CurrentPrincipal should register Nest route parameter metadata');

const nestModule = await Test.createTestingModule({ imports: [AuthorizationServerModule.forRoot(authOptions)] }).compile();
const injectedAccessTokenGuard = nestModule.get(AccessTokenGuard);
const injectedScopesGuard = nestModule.get(ScopesGuard);
const injectedRequest: ExpressRequestLike = { headers: { authorization: `Bearer ${issued.accessToken}` } };
const injectedContext = {
  getHandler: () => NestController.prototype.list,
  getClass: () => NestController,
  switchToHttp: () => ({ getRequest: () => injectedRequest }),
};
assert(await injectedAccessTokenGuard.canActivate(injectedContext), 'AuthorizationServerModule should provide a DI-wired access token guard');
assert(injectedScopesGuard.canActivate(injectedContext), 'AuthorizationServerModule should provide a DI-wired scopes guard');
await nestModule.close();

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
    send(body: unknown) {
      this.body = body;
    },
    cookie(name: string, value: string) {
      const recorder = this as ExpressResponseLike & { cookies?: Record<string, string> };
      recorder.cookies = { ...recorder.cookies, [name]: value };
    },
    clearCookie(name: string) {
      (this as ExpressResponseLike & { clearedCookie?: string }).clearedCookie = name;
    },
  };
}

function unexpectedNext(error?: unknown) {
  throw error instanceof Error ? error : new Error('Express route should have handled the request');
}
