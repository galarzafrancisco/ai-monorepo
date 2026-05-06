export * from './types.js';
export * from './errors.js';
export * from './mcp.js';
export { createExpressAuthorizationServer } from './express.js';
export { sqliteStorage } from './storage/sqlite.js';

import { createDatabaseKeyStore, issueJwt, normalizeScopes, validateJwt } from './crypto.js';
import { AuthorizationServerError, InsufficientScopeError } from './errors.js';
import { createExpressAdapter } from './express.js';
import { createMcpServerHandle, type McpServerHandle } from './mcp.js';
import type {
  AuthorizationClient,
  AuthorizationServer,
  AuthorizationServerMetadata,
  AuthorizationServerOptions,
  DownstreamConnectionDefinition,
  DownstreamToken,
  DownstreamTokenExchangeInput,
  IssueTokenInput,
  JsonWebKeySet,
  McpServerDefinition,
  ProtectedResourceMetadata,
  ScopeDefinition,
  ValidateTokenOptions,
} from './types.js';

export async function createAuthorizationServer(options: AuthorizationServerOptions): Promise<AuthorizationServer> {
  const basePath = normalizeBasePath(options.basePath ?? '/auth');
  const publicOrigin = options.issuer.replace(/\/$/, '');
  const authorizationServerIssuer = publicOrigin.endsWith(basePath) ? publicOrigin : `${publicOrigin}${basePath}`;
  const issuer = options.accessTokens?.issuer ?? authorizationServerIssuer;
  const keys = options.keys ?? (await createDatabaseKeyStore(options.storage));
  await keys.getActiveSigningKey();
  const configuredScopes = new Map((options.scopes ?? []).map((scope) => [scope.id, scope]));
  const mcpServers = new Map<string, McpServerHandle>();
  const downstreamConnections = new Map<string, DownstreamConnectionDefinition>();

  const publicApi: AuthorizationServer = {
    express() {
      return createExpressAdapter({ auth: publicApi, options, issuer, authorizationServerIssuer, basePath, mcpServers, configuredScopes });
    },
    async issueToken(input: IssueTokenInput) {
      return issueJwt({
        ...input,
        issuer,
        keys,
        defaultTtlSeconds: options.accessTokens?.ttlSeconds,
      });
    },
    async validateToken(token: string, validateOptions?: ValidateTokenOptions) {
      return validateJwt({ token, issuer, keys, options: validateOptions });
    },
    async exchangeDownstreamToken(input: DownstreamTokenExchangeInput): Promise<DownstreamToken> {
      const connection = downstreamConnections.get(input.connection);
      if (!connection) throw new Error(`Unknown downstream connection: ${input.connection}`);
      const ctx = await publicApi.validateToken(input.subjectToken, { audience: input.audience });
      const requested = input.scopes ?? [];
      const allowed = new Set(
        connection.mappings?.filter((mapping) => ctx.scopes.includes(mapping.from)).map((mapping) => mapping.to) ?? [],
      );
      const missing = requested.filter((scope) => !allowed.has(scope));
      if (missing.length > 0) throw new InsufficientScopeError(`Missing downstream entitlements: ${missing.join(', ')}`);
      throw new AuthorizationServerError('Downstream token exchange requires a provider-specific exchange implementation', 'unsupported_grant_type', 501);
    },
    async registerMcpServer(input: McpServerDefinition) {
      const scopes = normalizeScopes(input.scopes ?? []).map((scope) => rememberScope(configuredScopes, scope));
      const handle = createMcpServerHandle(input, scopes);
      mcpServers.set(input.resource, handle);
      return handle;
    },
    async registerDownstreamConnection(input: DownstreamConnectionDefinition) {
      downstreamConnections.set(input.id, input);
      return input;
    },
    discovery: {
      async authorizationServerMetadata(): Promise<AuthorizationServerMetadata> {
        return {
          issuer: authorizationServerIssuer,
          authorization_endpoint: `${authorizationServerIssuer}/authorize`,
          token_endpoint: `${authorizationServerIssuer}/token`,
          jwks_uri: `${authorizationServerIssuer}/.well-known/jwks.json`,
          registration_endpoint: `${authorizationServerIssuer}/clients/register`,
          introspection_endpoint: `${authorizationServerIssuer}/introspect`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'password'],
          code_challenge_methods_supported: ['S256'],
          scopes_supported: [...configuredScopes.keys()],
        };
      },
      async protectedResourceMetadata(resource: string): Promise<ProtectedResourceMetadata> {
        const mcp = mcpServers.get(resource);
        return {
          resource,
          authorization_servers: [authorizationServerIssuer],
          scopes_supported: mcp ? mcp.scopes.map((scope) => scope.id) : [...configuredScopes.keys()],
          bearer_methods_supported: ['header'],
          resource_name: mcp?.name,
        };
      },
      async jwks(): Promise<JsonWebKeySet> {
        return { keys: await keys.listPublicKeys() };
      },
    },
  };

  return publicApi;
}

export function createPublicClient(input: { name?: string; redirectUris: string[]; scopes?: string[] }): AuthorizationClient {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name,
    redirectUris: input.redirectUris,
    scopes: input.scopes ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeBasePath(path: string): string {
  const prefixed = path.startsWith('/') ? path : `/${path}`;
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed;
}

function rememberScope(scopes: Map<string, ScopeDefinition>, scope: ScopeDefinition): ScopeDefinition {
  const existing = scopes.get(scope.id);
  if (existing) return existing;
  scopes.set(scope.id, scope);
  return scope;
}
