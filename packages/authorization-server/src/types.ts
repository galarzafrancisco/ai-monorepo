export type Principal = {
  id: string;
  displayName?: string;
  email?: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
};

export type ScopeDefinition = {
  id: string;
  description?: string;
};

export type AccessTokenClaims = {
  iss: string;
  sub: string;
  aud?: string | string[];
  exp: number;
  iat: number;
  jti?: string;
  scope?: string;
  principal?: Principal;
  [claim: string]: unknown;
};

export type AuthContext = {
  token: string;
  subject: string;
  principal?: Principal;
  scopes: string[];
  claims: AccessTokenClaims;
  requireScopes(scopes: string | string[], mode?: 'all' | 'any'): void;
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
  mapProfile(profile: unknown): Promise<Principal> | Principal;
};

export type IssueTokenInput = {
  subject: string;
  principal?: Principal;
  audience?: string | string[];
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
  scopeMode?: 'all' | 'any';
};

export type ClientDefinition = {
  id: string;
  name?: string;
  redirectUris: string[];
  scopes?: string[];
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

export type McpServerHandle = Omit<McpServerDefinition, 'scopes'> & {
  scopes: ScopeDefinition[];
  express(): {
    handle(factory: (ctx: McpRequestContext) => unknown): ExpressMiddleware;
  };
};

export type McpRequestContext = {
  principal?: Principal;
  auth: AuthContext;
  requireScopes(scopes: string | string[], mode?: 'all' | 'any'): void;
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
  exchangeToken?(input: {
    subject: string;
    principal?: Principal;
    subjectToken: string;
    audience?: string;
    scopes: string[];
  }): Promise<DownstreamToken | null>;
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
  scopes: string[];
  connection: string;
};

export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  introspection_endpoint: string;
  registration_endpoint?: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
};

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name?: string;
};

export type AuthorizationInteraction = {
  flowId: string;
  client: ClientDefinition;
  resource?: string;
  audience?: string;
  scopes: ScopeDefinition[];
  principal?: Principal;
  loginRequired: boolean;
  consentRequired: boolean;
  downstreamConnectionsRequired: DownstreamConnectionDefinition[];
};

export type AuthorizationStorage = {
  clients: Map<string, ClientDefinition>;
  interactions: Map<string, AuthorizationInteraction>;
  grants: Map<string, unknown>;
  downstreamConnections: Map<string, DownstreamConnectionDefinition>;
};

export type KeyStore = {
  getActiveSigningKey(): Promise<CryptoKey>;
  getActiveKeyId(): Promise<string>;
  getVerificationKey(kid?: string): Promise<CryptoKey>;
  listPublicKeys(): Promise<JsonWebKey[]>;
  rotate?(): Promise<void>;
};

export type AuthorizationServerOptions = {
  issuer: string;
  basePath?: string;
  storage?: AuthorizationStorage;
  keys?: KeyStore;
  identityProvider?: IdentityProvider;
  scopes?: Array<string | ScopeDefinition>;
  accessTokens?: {
    ttlSeconds?: number;
    issuer?: string;
  };
  session?: {
    cookieName?: string;
    refreshCookieName?: string;
    secureCookies?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  };
  mcp?: {
    enabled?: boolean;
    dynamicClientRegistration?: {
      enabled?: boolean;
      pruneAfterDays?: number;
    };
  };
};

export type MetadataInput = {
  resource?: string;
};

export type ExpressRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  auth?: AuthContext;
  method?: string;
  path?: string;
  url?: string;
  body?: unknown;
};

export type ExpressResponseLike = {
  status(code: number): ExpressResponseLike;
  json(body: unknown): void;
  set?(name: string, value: string): ExpressResponseLike | void;
  send?(body: unknown): void;
};

export type ExpressNextFunction = (error?: unknown) => void;
export type ExpressMiddleware = (
  req: ExpressRequestLike,
  res: ExpressResponseLike,
  next: ExpressNextFunction,
) => Promise<void> | void;
