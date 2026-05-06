import type { JWK, JWTPayload } from 'jose';

export type Principal = {
  id: string;
  displayName?: string;
  email?: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
};

export type AccessTokenClaims = JWTPayload & {
  sub: string;
  scope?: string;
  principal?: Principal;
};

export type AuthContext = {
  token: string;
  subject: string;
  principal?: Principal;
  scopes: string[];
  claims: AccessTokenClaims;
};

export type ScopeDefinition = {
  id: string;
  description?: string;
};

export type IdentityProvider = {
  authenticatePassword?(input: {
    username?: string;
    email?: string;
    password: string;
  }): Promise<Principal | null>;
  findPrincipalById?(id: string): Promise<Principal | null>;
  externalProviders?: ExternalOAuthProvider[];
};

export type ExternalOAuthProvider = {
  id: string;
  displayName: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  mapProfile?(profile: unknown): Promise<Principal> | Principal;
};

export type IssueTokenInput = {
  subject: string;
  principal?: Principal;
  audience?: string;
  scopes?: string[];
  ttlSeconds?: number;
  claims?: Record<string, unknown>;
};

export type IssuedToken = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
};

export type ValidateTokenOptions = {
  audience?: string;
  requiredScopes?: string[];
};

export type McpServerDefinition = {
  id: string;
  name: string;
  version: string;
  resource: string;
  transport?: 'streamable-http' | 'sse' | 'stdio';
  scopes?: Array<string | ScopeDefinition>;
  requiredScopes?: string[];
};

export type DownstreamConnectionDefinition = {
  id: string;
  displayName: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  resource?: string;
  scopes?: string[];
  mappings?: Array<{ from: string; to: string }>;
};

export type DownstreamTokenExchangeInput = {
  subjectToken: string;
  audience?: string;
  connection: string;
  scopes?: string[];
};

export type DownstreamToken = {
  accessToken: string;
  tokenType: 'Bearer';
  scope: string;
  connection: string;
};

export type AuthorizationClient = {
  id: string;
  secret?: string;
  name?: string;
  redirectUris: string[];
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type AuthorizationCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  subject: string;
  principal?: Principal;
  scopes: string[];
  audience?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: string;
  usedAt?: string;
};

export type AuthorizationInteraction = {
  flowId: string;
  client: { id: string; name?: string; redirectUris: string[] };
  redirectUri: string;
  state?: string;
  resource?: string;
  audience?: string;
  scopes: ScopeDefinition[];
  principal?: Principal;
  loginRequired: boolean;
  consentRequired: boolean;
};

export type StoredAuthorizationInteraction = AuthorizationInteraction & {
  clientId: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: string;
  expiresAt: string;
};

export type JsonWebKeySet = { keys: JWK[] };

export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  introspection_endpoint?: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
};

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name?: string;
};

export type KeyStore = {
  getActiveSigningKey(): Promise<JWK>;
  listPublicKeys(): Promise<JWK[]>;
  rotate?(): Promise<void>;
};

export type AuthorizationStorage = {
  saveClient(client: AuthorizationClient): Promise<void>;
  getClient(id: string): Promise<AuthorizationClient | null>;
  touchClient(id: string): Promise<void>;
  saveAuthorizationCode(code: AuthorizationCode): Promise<void>;
  consumeAuthorizationCode(code: string): Promise<AuthorizationCode | null>;
  saveInteraction(interaction: StoredAuthorizationInteraction): Promise<void>;
  getInteraction(flowId: string): Promise<StoredAuthorizationInteraction | null>;
  deleteInteraction(flowId: string): Promise<void>;
  rememberGrant(input: { subject: string; clientId: string; audience?: string; scopes: string[] }): Promise<void>;
  hasGrant(input: { subject: string; clientId: string; audience?: string; scopes: string[] }): Promise<boolean>;
  saveSigningKey?(key: JWK): Promise<void>;
  getActiveSigningKey?(): Promise<JWK | null>;
  listPublicSigningKeys?(): Promise<JWK[]>;
};

export type AuthorizationServerOptions = {
  issuer: string;
  basePath?: string;
  storage: AuthorizationStorage;
  keys?: KeyStore;
  identityProvider: IdentityProvider;
  scopes?: ScopeDefinition[];
  session?: {
    cookieName?: string;
    refreshCookieName?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    ttlSeconds?: number;
  };
  accessTokens?: { ttlSeconds?: number; issuer?: string };
  refreshTokens?: { ttlSeconds?: number; rotate?: boolean };
  mcp?: { enabled?: boolean; dynamicClientRegistration?: { enabled?: boolean; pruneAfterDays?: number } };
  grants?: {
    password?: boolean;
  };
  cors?:
    | boolean
    | {
        origins?: '*' | string[];
        methods?: string[];
        headers?: string[];
        credentials?: boolean;
      };
  screens?: {
    login?: { mode?: 'default' | 'hosted'; path?: string; allowPassword?: boolean; allowExternalProviders?: boolean };
    consent?: { mode?: 'default' | 'hosted'; path?: string; allowSwitchAccount?: boolean; rememberGrants?: boolean };
  };
};

export type AuthorizationServer = {
  express(): import('./express.js').ExpressAuthAdapter;
  issueToken(input: IssueTokenInput): Promise<IssuedToken>;
  validateToken(token: string, options?: ValidateTokenOptions): Promise<AuthContext>;
  exchangeDownstreamToken(input: DownstreamTokenExchangeInput): Promise<DownstreamToken>;
  registerMcpServer(input: McpServerDefinition): Promise<import('./mcp.js').McpServerHandle>;
  registerDownstreamConnection(input: DownstreamConnectionDefinition): Promise<DownstreamConnectionDefinition>;
  discovery: {
    wellKnownUrl(): string;
    protectedResourceMetadataUrl(resource: string): string;
    authorizationServerMetadata(): Promise<AuthorizationServerMetadata>;
    protectedResourceMetadata(resource: string): Promise<ProtectedResourceMetadata>;
    jwks(): Promise<JsonWebKeySet>;
  };
};
