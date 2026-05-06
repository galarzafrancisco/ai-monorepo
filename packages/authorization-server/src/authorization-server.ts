import { SignJWT, jwtVerify } from 'jose';
import {
  DownstreamTokenUnavailableError,
  InsufficientScopeError,
  InvalidTokenError,
  UnknownDownstreamConnectionError,
} from './errors.js';
import { memoryKeyStore } from './key-store.js';
import { memoryStorage } from './storage/memory.js';
import { createExpressAdapter } from './express.js';
import { createNestAdapter } from './nest.js';
import type {
  AccessTokenClaims,
  AuthContext,
  AuthorizationGrant,
  AuthorizationInteraction,
  AuthorizationServerMetadata,
  AuthorizationServerOptions,
  AuthorizationStorage,
  ClientDefinition,
  DownstreamConnectionDefinition,
  DownstreamToken,
  DownstreamTokenExchangeInput,
  IdentityProvider,
  IssueTokenInput,
  IssuedToken,
  KeyStore,
  McpServerDefinition,
  McpServerHandle,
  MetadataInput,
  Principal,
  ProtectedResourceMetadata,
  ScopeDefinition,
  ValidateTokenOptions,
} from './types.js';

export type AuthorizationServer = Awaited<ReturnType<typeof createAuthorizationServer>>;

export async function createAuthorizationServer(options: AuthorizationServerOptions) {
  const keys = options.keys ?? (await memoryKeyStore());
  return new CoreAuthorizationServer({
    ...options,
    basePath: normalizeBasePath(options.basePath ?? '/auth'),
    keys,
    storage: options.storage ?? memoryStorage(),
  });
}

class CoreAuthorizationServer {
  private readonly issuer: string;
  readonly basePath: string;
  private readonly storage: AuthorizationStorage;
  private readonly keys: KeyStore;
  private readonly identityProvider?: IdentityProvider;
  private readonly scopes = new Map<string, ScopeDefinition>();
  private readonly mcpServers = new Map<string, McpServerHandle>();
  private readonly defaultTtlSeconds: number;
  readonly sessionCookieName: string;

  constructor(options: AuthorizationServerOptions & { storage: AuthorizationStorage; keys: KeyStore }) {
    this.issuer = options.accessTokens?.issuer ?? options.issuer;
    this.basePath = normalizeBasePath(options.basePath ?? '/auth');
    this.storage = options.storage;
    this.keys = options.keys;
    this.identityProvider = options.identityProvider;
    this.defaultTtlSeconds = options.accessTokens?.ttlSeconds ?? 15 * 60;
    this.sessionCookieName = options.session?.cookieName ?? 'access_token';

    for (const scope of options.scopes ?? []) {
      const definition = normalizeScope(scope);
      this.scopes.set(definition.id, definition);
    }
  }

  express() {
    return createExpressAdapter(this);
  }

  nest() {
    return createNestAdapter(this);
  }

  async issueToken(input: IssueTokenInput): Promise<IssuedToken> {
    const ttlSeconds = input.ttlSeconds ?? this.defaultTtlSeconds;
    const scopes = input.scopes ?? [];
    const signingKey = await this.keys.getActiveSigningKey();
    const kid = await this.keys.getActiveKeyId();
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await new SignJWT({
      ...(input.claims ?? {}),
      scope: scopes.join(' '),
      principal: input.principal,
    })
      .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
      .setIssuer(this.issuer)
      .setSubject(input.subject)
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .setJti(crypto.randomUUID())
      .setAudience(input.audience ?? this.issuer)
      .sign(signingKey);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ttlSeconds,
      scope: scopes.join(' '),
    };
  }

  async validateToken(token: string, options: ValidateTokenOptions = {}): Promise<AuthContext> {
    try {
      const { protectedHeader, payload } = await jwtVerify(token, (header) => this.keys.getVerificationKey(header.kid), {
        issuer: this.issuer,
        audience: options.audience,
      });

      if (!protectedHeader.kid) {
        throw new InvalidTokenError('Access token is missing a key id');
      }

      const claims = payload as AccessTokenClaims;
      const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [];
      requireScopes(scopes, options.requiredScopes ?? [], options.scopeMode ?? 'all');

      const embeddedPrincipal = isPrincipal(claims.principal) ? claims.principal : undefined;
      const principal =
        embeddedPrincipal ??
        (this.identityProvider?.findPrincipalById && claims.sub
          ? await this.identityProvider.findPrincipalById(claims.sub)
          : undefined) ??
        undefined;

      return {
        token,
        subject: claims.sub,
        principal,
        scopes,
        claims,
        requireScopes(required, mode = 'all') {
          requireScopes(scopes, Array.isArray(required) ? required : [required], mode);
        },
      };
    } catch (error) {
      if (error instanceof InsufficientScopeError || error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError(error instanceof Error ? error.message : undefined);
    }
  }

  async registerMcpServer(input: McpServerDefinition): Promise<McpServerHandle> {
    const scopes = (input.scopes ?? []).map(normalizeScope);
    for (const scope of scopes) {
      this.scopes.set(scope.id, scope);
    }

    const handle: McpServerHandle = {
      ...input,
      transport: input.transport ?? 'streamable-http',
      scopes,
      express: () => ({
        handle: (factory) => async (req, res, next) => {
          try {
            const auth = await this.validateToken(extractBearerToken(req.headers) ?? '', {
              audience: input.resource,
              requiredScopes: input.requiredScopes ?? [],
            });
            const result = factory({
              principal: auth.principal,
              auth,
              requireScopes: (required, mode) => auth.requireScopes(required, mode),
            });
            res.json(await result);
          } catch (error) {
            next(error);
          }
        },
      }),
    };

    this.mcpServers.set(input.id, handle);
    return handle;
  }

  async registerDownstreamConnection(input: DownstreamConnectionDefinition) {
    this.storage.downstreamConnections.set(input.id, input);
    return { id: input.id, displayName: input.displayName };
  }

  registerClient(input: ClientDefinition): ClientDefinition {
    const id = input.id || crypto.randomUUID();
    const client = { ...input, id };
    this.storage.clients.set(id, client);
    return client;
  }

  getClient(clientId: string) {
    return this.storage.clients.get(clientId);
  }

  async authenticatePassword(input: { username?: string; email?: string; password: string }) {
    const principal = await this.identityProvider?.authenticatePassword?.(input);
    if (!principal) return null;
    return this.issueToken({ subject: principal.id, principal, scopes: [...this.scopes.keys()] });
  }

  async createAuthorizationInteraction(input: {
    clientId: string;
    redirectUri?: string;
    scope?: string;
    state?: string;
    resource?: string;
    audience?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'plain' | 'S256';
    principal?: Principal;
  }): Promise<AuthorizationInteraction> {
    const client = this.storage.clients.get(input.clientId);
    if (!client) {
      throw new InvalidTokenError(`Unknown OAuth client: ${input.clientId}`);
    }
    if (input.redirectUri && !client.redirectUris.includes(input.redirectUri)) {
      throw new InvalidTokenError('Redirect URI is not registered for this client');
    }

    const requestedScopes = parseScope(input.scope || client.scopes?.join(' ') || '');
    const flow: AuthorizationInteraction = {
      flowId: crypto.randomUUID(),
      client,
      redirectUri: input.redirectUri,
      state: input.state,
      resource: input.resource,
      audience: input.audience ?? input.resource,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      scopes: requestedScopes.map((scope) => this.scopes.get(scope) ?? { id: scope }),
      principal: input.principal,
      loginRequired: !input.principal,
      consentRequired: true,
      downstreamConnectionsRequired: [],
    };
    this.storage.interactions.set(flow.flowId, flow);
    return flow;
  }

  approveAuthorizationInteraction(flowId: string, principal: Principal): AuthorizationGrant {
    const flow = this.storage.interactions.get(flowId);
    if (!flow) {
      throw new InvalidTokenError('Unknown authorization flow');
    }
    const grant: AuthorizationGrant = {
      code: crypto.randomUUID(),
      clientId: flow.client.id,
      redirectUri: flow.redirectUri,
      state: flow.state,
      subject: principal.id,
      principal,
      audience: flow.audience,
      scopes: flow.scopes.map((scope) => scope.id),
      codeChallenge: flow.codeChallenge,
      codeChallengeMethod: flow.codeChallengeMethod,
      createdAt: Date.now(),
    };
    this.storage.grants.set(grant.code, grant);
    this.storage.interactions.delete(flowId);
    return grant;
  }

  denyAuthorizationInteraction(flowId: string) {
    const flow = this.storage.interactions.get(flowId);
    if (flow) {
      this.storage.interactions.delete(flowId);
    }
    return flow;
  }

  async exchangeAuthorizationCode(input: { code: string; clientId?: string; redirectUri?: string; codeVerifier?: string }) {
    const grant = this.storage.grants.get(input.code) as AuthorizationGrant | undefined;
    if (!grant || grant.consumed) {
      throw new InvalidTokenError('Invalid authorization code');
    }
    if (input.clientId && grant.clientId !== input.clientId) {
      throw new InvalidTokenError('Authorization code was issued to a different client');
    }
    if (grant.redirectUri && input.redirectUri && grant.redirectUri !== input.redirectUri) {
      throw new InvalidTokenError('Redirect URI does not match authorization code');
    }
    if (grant.codeChallenge && !(await verifyCodeChallenge(input.codeVerifier ?? '', grant.codeChallenge, grant.codeChallengeMethod))) {
      throw new InvalidTokenError('PKCE verifier does not match authorization code');
    }
    grant.consumed = true;
    this.storage.grants.set(input.code, grant);
    return this.issueToken({ subject: grant.subject, principal: grant.principal, audience: grant.audience, scopes: grant.scopes });
  }

  async exchangeDownstreamToken(input: DownstreamTokenExchangeInput): Promise<DownstreamToken> {
    const connection = this.storage.downstreamConnections.get(input.connection);
    if (!connection) {
      throw new UnknownDownstreamConnectionError(input.connection);
    }

    const auth = await this.validateToken(input.subjectToken, { audience: input.audience });
    const requestedScopes = input.scopes ?? connection.scopes ?? [];
    const allowedScopes = new Set(
      (connection.mappings ?? [])
        .filter((mapping) => auth.scopes.includes(mapping.from))
        .map((mapping) => mapping.to),
    );
    const unmapped = requestedScopes.filter((scope) => !allowedScopes.has(scope));
    if ((connection.mappings?.length ?? 0) > 0 && unmapped.length > 0) {
      throw new InsufficientScopeError(unmapped);
    }

    if (!connection.exchangeToken) {
      throw new DownstreamTokenUnavailableError(input.connection);
    }

    const downstreamToken = await connection.exchangeToken({
      subject: auth.subject,
      principal: auth.principal,
      subjectToken: input.subjectToken,
      audience: input.audience,
      scopes: requestedScopes,
    });
    if (!downstreamToken) {
      throw new DownstreamTokenUnavailableError(input.connection);
    }

    return {
      ...downstreamToken,
      scopes: downstreamToken.scopes.length > 0 ? downstreamToken.scopes : requestedScopes,
      connection: input.connection,
    };
  }

  discovery = {
    authorizationServerMetadata: async (_input?: MetadataInput): Promise<AuthorizationServerMetadata> => ({
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}${this.basePath}/authorize`,
      token_endpoint: `${this.issuer}${this.basePath}/token`,
      introspection_endpoint: `${this.issuer}${this.basePath}/introspect`,
      registration_endpoint: `${this.issuer}${this.basePath}/clients/register`,
      jwks_uri: `${this.issuer}/.well-known/jwks.json`,
      scopes_supported: [...this.scopes.keys()],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials', 'urn:ietf:params:oauth:grant-type:token-exchange'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    }),
    protectedResourceMetadata: async (resource: string): Promise<ProtectedResourceMetadata> => {
      const mcp = [...this.mcpServers.values()].find((server) => server.resource === resource);
      return {
        resource,
        authorization_servers: [this.issuer],
        scopes_supported: mcp ? mcp.scopes.map((scope) => scope.id) : [...this.scopes.keys()],
        bearer_methods_supported: ['header'],
        resource_name: mcp?.name,
      };
    },
    jwks: async () => ({ keys: await this.keys.listPublicKeys() }),
  };
}

export function requireScopes(actual: string[], required: string[], mode: 'all' | 'any' = 'all') {
  if (required.length === 0) return;
  const allowed = new Set(actual);
  const passes = mode === 'all' ? required.every((scope) => allowed.has(scope)) : required.some((scope) => allowed.has(scope));
  if (!passes) {
    throw new InsufficientScopeError(required);
  }
}

export function normalizeScope(scope: string | ScopeDefinition): ScopeDefinition {
  return typeof scope === 'string' ? { id: scope } : scope;
}

export function extractBearerToken(headers: Record<string, string | string[] | undefined> | undefined) {
  const header = headers?.authorization ?? headers?.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function parseScope(scope: string | undefined) {
  return (scope ?? '').split(/\s+/).map((value) => value.trim()).filter(Boolean);
}

async function verifyCodeChallenge(verifier: string, challenge: string, method: 'plain' | 'S256' = 'plain') {
  if (method === 'plain') return verifier === challenge;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return encoded === challenge;
}

function normalizeBasePath(path: string) {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

function isPrincipal(value: unknown): value is Principal {
  return typeof value === 'object' && value !== null && typeof (value as Principal).id === 'string';
}
