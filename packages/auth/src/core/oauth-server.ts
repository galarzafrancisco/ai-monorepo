import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  isSameResource,
  literalAudience,
  type AudiencePolicy,
} from './audience.js';
import {
  ClientMetadataDocumentFetcher,
  type ClientMetadataFetchOptions,
} from './client-metadata-fetcher.js';
import { ClientDirectory, type ClientRegistrationRequest } from './clients.js';
import {
  InvalidAccessTokenError,
  InvalidCredentialsError,
  OAuthError,
} from './errors.js';
import { CLIENT_ASSERTION_SIGNING_ALGORITHMS } from './jwks-validation.js';
import { KeyManager } from './keys.js';
import type {
  AuthHooks,
  ClaimsProvider,
  Client,
  ClientStore,
  Grant,
  GrantStore,
  IdentityProvider,
  IssuedTokenStore,
  KeyStore,
  ProtectedResource,
  RefreshTokenStore,
  ResourceRegistry,
  SessionScopePolicy,
  StoredRefreshToken,
} from './ports.js';
import { isRegisteredRedirectUri } from './redirect-uri.js';
import {
  buildProtectedResourceMetadata,
  ResourceServer,
  type ProtectedResourceMetadata,
} from './resource-server.js';
import { formatScope, parseScope, ScopeRegistry } from './scopes.js';
import { TokenSigner, TokenVerifier, type SignedToken } from './tokens.js';
import {
  silentLogger,
  systemClock,
  type AccessTokenClaims,
  type Clock,
  type Logger,
  type Subject,
} from './types.js';

export type AuthConfig = {
  /** Issuer identifier: the public base URL of the server, no trailing slash */
  issuer: string;
  /** Path the authorization server endpoints are mounted under. Default `/oauth`. */
  basePath?: string;
  /**
   * Where the user approves a request: a page of the host's UI. The grant ID
   * is appended as `?grant_id=`. Default `${issuer}${basePath}/consent`.
   */
  consentUrl?: string;
  /** Resource used when a request names none (RFC 8707 `resource`) */
  defaultResource?: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlDays?: number;
  authorizationCodeTtlSeconds?: number;
  keySigningTtlHours?: number;
  keyVerifyingTtlHours?: number;
  /** Browser sessions */
  sessionAudience?: string;
  sessionClientId?: string;
  sessionAccessTokenTtlSeconds?: number;
  sessionRefreshTokenTtlDays?: number;
};

export type OAuthServerOptions = {
  config: AuthConfig;
  stores: {
    keys: KeyStore;
    clients: ClientStore;
    grants: GrantStore;
    refreshTokens: RefreshTokenStore;
    /** Needed to issue long-lived tokens and to revoke access tokens */
    issuedTokens?: IssuedTokenStore;
  };
  resources: ResourceRegistry;
  /** Needed for login and to put the user's details in tokens */
  identity?: IdentityProvider;
  claims?: ClaimsProvider;
  hooks?: AuthHooks;
  /** Scopes the server advertises, beyond those of its resources */
  scopes?: ScopeRegistry;
  sessionScopes?: SessionScopePolicy;
  clientMetadata?: Partial<ClientMetadataFetchOptions>;
  logger?: Logger;
  clock?: Clock;
};

export type AuthorizationRequest = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
};

export type TokenRequest = {
  grant_type?: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  refresh_token?: string;
  client_id?: string;
  client_assertion_type?: string;
  client_assertion?: string;
  resource?: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

export type ConsentDetails = {
  grantId: string;
  status: Grant['status'];
  scopes: { id: string; description: string }[];
  resource: { identifier: string; name: string; resourceUrl: string };
  client: {
    clientId: string;
    clientName: string;
    registrationMethod: Client['registrationMethod'];
  };
  redirectUri: string;
  createdAt: Date;
};

export type IntrospectionResult =
  | { active: false }
  | ({ active: true; token_type: 'Bearer' } & Record<string, unknown>);

export type SessionTokens = {
  subject: Subject;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
};

export type IssueTokenRequest = {
  subject: Subject | string;
  scopes: string[];
  ttlSeconds: number;
  /** Defaults to the issuer: a token for the host's own API */
  audience?: string | string[];
  clientId?: string;
  /** Record it so it can be listed and revoked. Needs `stores.issuedTokens`. */
  record?: { name: string; issuedBy?: string };
  claims?: Record<string, unknown>;
};

/** RFC 8414 authorization server metadata */
export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  introspection_endpoint: string;
  revocation_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  code_challenge_methods_supported: string[];
  client_id_metadata_document_supported: boolean;
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
const DAY_SECONDS = 24 * 60 * 60;

/**
 * The authorization server: OAuth 2.1 authorization code flow with PKCE,
 * refresh token rotation, introspection, revocation, client registration and
 * browser sessions. Framework-free; every method takes and returns plain data.
 */
export class OAuthServer {
  readonly config: Required<Omit<AuthConfig, 'defaultResource'>> &
    Pick<AuthConfig, 'defaultResource'>;
  readonly keys: KeyManager;
  readonly signer: TokenSigner;
  readonly verifier: TokenVerifier;
  readonly clients: ClientDirectory;
  readonly scopes: ScopeRegistry;

  private readonly stores: OAuthServerOptions['stores'];
  private readonly resources: ResourceRegistry;
  private readonly identity?: IdentityProvider;
  private readonly claims?: ClaimsProvider;
  private readonly hooks: AuthHooks;
  private readonly sessionScopes: SessionScopePolicy;
  private readonly logger: Logger;
  private readonly clock: Clock;

  constructor(options: OAuthServerOptions) {
    const issuer = options.config.issuer.replace(/\/+$/, '');
    const basePath = options.config.basePath ?? '/oauth';
    this.config = {
      consentUrl: `${issuer}${basePath}/consent`,
      accessTokenTtlSeconds: 600,
      refreshTokenTtlDays: 30,
      authorizationCodeTtlSeconds: 600,
      keySigningTtlHours: 72,
      keyVerifyingTtlHours: 72,
      sessionAudience: issuer,
      sessionClientId: 'web-session',
      sessionAccessTokenTtlSeconds: 15 * 60,
      sessionRefreshTokenTtlDays: 7,
      ...options.config,
      issuer,
      basePath,
    };
    this.stores = options.stores;
    this.resources = options.resources;
    this.identity = options.identity;
    this.claims = options.claims;
    this.hooks = options.hooks ?? {};
    this.scopes = options.scopes ?? new ScopeRegistry();
    this.sessionScopes = options.sessionScopes ?? (() => this.scopes.ids());
    this.logger = options.logger ?? silentLogger;
    this.clock = options.clock ?? systemClock;

    this.keys = new KeyManager({
      store: options.stores.keys,
      signingTtlHours: this.config.keySigningTtlHours,
      verifyingTtlHours: this.config.keyVerifyingTtlHours,
      clock: this.clock,
      logger: this.logger,
    });
    this.signer = new TokenSigner(this.keys, issuer, this.clock);
    this.verifier = new TokenVerifier({
      issuer,
      jwks: this.keys,
      revocation: options.stores.issuedTokens,
    });
    this.clients = new ClientDirectory(
      options.stores.clients,
      new ClientMetadataDocumentFetcher(options.clientMetadata),
      this.clock,
      this.logger,
    );
  }

  /** A resource server that trusts this issuer, sharing its keys in-process */
  resourceServer(
    options: {
      audience?: AudiencePolicy;
      cookieName?: string;
      realm?: string;
    } = {},
  ): ResourceServer {
    return new ResourceServer({
      verifier: this.verifier,
      baseUrl: this.config.issuer,
      logger: this.logger,
      ...options,
      audience:
        options.audience ??
        literalAudience(this.config.issuer, this.config.sessionAudience),
    });
  }

  // -------------------------------------------------------------- endpoints

  get endpoints() {
    const base = `${this.config.issuer}${this.config.basePath}`;
    return {
      authorization: `${base}/authorize`,
      token: `${base}/token`,
      registration: `${base}/register`,
      introspection: `${base}/introspect`,
      revocation: `${base}/revoke`,
      jwks: `${this.config.issuer}/.well-known/jwks.json`,
    };
  }

  metadata(): AuthorizationServerMetadata {
    const endpoints = this.endpoints;
    return {
      issuer: this.config.issuer,
      authorization_endpoint: endpoints.authorization,
      token_endpoint: endpoints.token,
      registration_endpoint: endpoints.registration,
      introspection_endpoint: endpoints.introspection,
      revocation_endpoint: endpoints.revocation,
      jwks_uri: endpoints.jwks,
      scopes_supported: this.scopes.ids().sort(),
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      // Public clients, and metadata document clients that sign a JWT with a
      // key they publish. Neither involves a shared secret.
      token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported:
        CLIENT_ASSERTION_SIGNING_ALGORITHMS,
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
    };
  }

  /** RFC 9728 metadata of the resource served at `path`, or null */
  async protectedResourceMetadata(
    path: string,
  ): Promise<ProtectedResourceMetadata | null> {
    const resource = await this.resources.findByPath(path);
    return resource
      ? buildProtectedResourceMetadata(resource, [this.config.issuer])
      : null;
  }

  // -------------------------------------------------------------- registration

  async register(request: ClientRegistrationRequest): Promise<Client> {
    const client = await this.clients.register(request);
    this.logger.log(`Registered client ${client.clientId} (${client.clientName})`);
    return client;
  }

  // -------------------------------------------------------------- authorize

  /**
   * Starts an authorization: validates the request and stores it as a pending
   * grant. Returns where to send the user to approve it. Throws `OAuthError`
   * for anything wrong; none of those errors are redirected to the client,
   * because nothing about the client is trusted until this returns.
   */
  async authorize(
    request: AuthorizationRequest,
  ): Promise<{ grantId: string; redirectTo: string }> {
    if (request.response_type !== 'code') {
      throw new OAuthError('unsupported_response_type', 'response_type must be "code"');
    }
    if (!request.client_id || !request.redirect_uri) {
      throw new OAuthError('invalid_request', 'client_id and redirect_uri are required');
    }
    const client = await this.clients.resolve(request.client_id);
    if (!isRegisteredRedirectUri(client.redirectUris, request.redirect_uri)) {
      throw new OAuthError(
        'invalid_request',
        'redirect_uri is not registered for this client',
      );
    }
    if (!request.code_challenge) {
      throw new OAuthError('invalid_request', 'code_challenge is required (PKCE)');
    }
    if ((request.code_challenge_method ?? 'plain') !== 'S256') {
      throw new OAuthError('invalid_request', 'code_challenge_method must be S256');
    }

    const resource = await this.resolveResource(request.resource);
    // Only scopes the resource defines are granted; unknown ones are dropped
    const allowed = new Set(resource.scopes.map((scope) => scope.id));
    const scopes = parseScope(request.scope).filter((scope) => allowed.has(scope));

    const grant = await this.stores.grants.create({
      clientId: client.clientId,
      resourceId: resource.id,
      resource: resource.resourceUrl,
      scopes,
      redirectUri: request.redirect_uri,
      state: request.state ?? null,
      codeChallenge: request.code_challenge,
      codeChallengeMethod: 'S256',
      status: 'pending',
      subjectId: null,
      codeHash: null,
      codeExpiresAt: null,
    });

    const consentUrl = new URL(this.config.consentUrl);
    consentUrl.searchParams.set('grant_id', grant.id);
    return { grantId: grant.id, redirectTo: consentUrl.toString() };
  }

  /** The resource a request targets, by RFC 8707 `resource` or the default */
  private async resolveResource(requested?: string): Promise<ProtectedResource> {
    const identifier = requested ?? this.config.defaultResource;
    if (!identifier) {
      throw new OAuthError('invalid_target', 'A resource parameter is required');
    }
    const resource = await this.resources.find(identifier);
    if (!resource) {
      throw new OAuthError('invalid_target', `Unknown resource: ${identifier}`);
    }
    return resource;
  }

  /** What the consent screen shows for a grant */
  async getConsent(grantId: string): Promise<ConsentDetails> {
    const grant = await this.findGrant(grantId);
    const [client, resource] = await Promise.all([
      this.stores.clients.findByClientId(grant.clientId),
      this.resources.find(grant.resourceId),
    ]);
    if (!client || !resource) {
      throw new OAuthError('invalid_request', 'Authorization request is no longer valid');
    }
    const descriptions = new Map(resource.scopes.map((scope) => [scope.id, scope]));
    return {
      grantId: grant.id,
      status: grant.status,
      scopes: grant.scopes.map(
        (id) => descriptions.get(id) ?? { id, description: '' },
      ),
      resource: {
        identifier: resource.identifier,
        name: resource.name,
        resourceUrl: resource.resourceUrl,
      },
      client: {
        clientId: client.clientId,
        clientName: client.clientName,
        registrationMethod: client.registrationMethod,
      },
      redirectUri: grant.redirectUri,
      createdAt: grant.createdAt,
    };
  }

  /**
   * Records the user's decision. `subjectId` is the logged-in user, resolved
   * by the caller from its session; the core never reads a request.
   * Returns where to send the user next.
   */
  async decide(input: {
    grantId: string;
    approved: boolean;
    subjectId: string;
  }): Promise<{ redirectTo: string }> {
    const grant = await this.findGrant(input.grantId);
    if (grant.status !== 'pending') {
      throw new OAuthError('invalid_request', 'Authorization request was already decided');
    }

    if (!input.approved) {
      await this.stores.grants.save({ ...grant, status: 'denied' });
      return {
        redirectTo: redirectWith(grant, {
          error: 'access_denied',
          error_description: 'User denied the authorization request',
        }),
      };
    }

    const approved = await this.stores.grants.save({
      ...grant,
      status: 'approved',
      subjectId: input.subjectId,
    });
    const outcome = await this.hooks.afterConsent?.(approved);
    if (outcome && 'redirectTo' in outcome) {
      return { redirectTo: outcome.redirectTo };
    }
    return this.completeAuthorization(approved.id);
  }

  /**
   * Issues the authorization code for an approved grant and returns the
   * redirect back to the client. `decide` calls this itself unless the
   * `afterConsent` hook sent the user elsewhere first.
   */
  async completeAuthorization(grantId: string): Promise<{ redirectTo: string }> {
    const grant = await this.findGrant(grantId);
    if (grant.status !== 'approved' || !grant.subjectId) {
      throw new OAuthError('invalid_request', 'Authorization request is not approved');
    }
    const code = randomToken();
    await this.stores.grants.save({
      ...grant,
      status: 'code_issued',
      codeHash: sha256(code),
      codeExpiresAt: new Date(
        this.clock.now().getTime() + this.config.authorizationCodeTtlSeconds * 1000,
      ),
    });
    return { redirectTo: redirectWith(grant, { code, iss: this.config.issuer }) };
  }

  private async findGrant(grantId: string): Promise<Grant> {
    const grant = await this.stores.grants.findById(grantId);
    if (!grant) {
      throw new OAuthError('invalid_request', 'Unknown authorization request', 404);
    }
    return grant;
  }

  // -------------------------------------------------------------- token

  async token(request: TokenRequest): Promise<TokenResponse> {
    switch (request.grant_type) {
      case 'authorization_code':
        return this.exchangeCode(request);
      case 'refresh_token':
        return this.refresh(request);
      default:
        throw new OAuthError(
          'unsupported_grant_type',
          `Unsupported grant_type: ${String(request.grant_type)}`,
        );
    }
  }

  private async exchangeCode(request: TokenRequest): Promise<TokenResponse> {
    if (!request.code || !request.code_verifier || !request.redirect_uri) {
      throw new OAuthError(
        'invalid_request',
        'code, code_verifier and redirect_uri are required',
      );
    }
    const invalid = (reason: string) => new OAuthError('invalid_grant', reason);

    const grant = await this.stores.grants.findByCodeHash(sha256(request.code));
    if (!grant) {
      throw invalid('Invalid authorization code');
    }
    const client = await this.clientOf(grant);
    this.assertResourceMatches(grant, request);
    await this.authenticateClient(client, request);

    if (grant.status === 'exchanged') {
      // A code presented twice was probably stolen: drop what it produced
      await this.revokeGrant(grant);
      throw invalid('Authorization code has already been used');
    }
    if (grant.status !== 'code_issued') {
      throw invalid('Invalid authorization code');
    }
    if (!grant.codeExpiresAt || this.clock.now() > grant.codeExpiresAt) {
      throw invalid('Authorization code has expired');
    }
    if (grant.redirectUri !== request.redirect_uri) {
      throw invalid('redirect_uri does not match the authorization request');
    }
    if (!verifyPkce(request.code_verifier, grant.codeChallenge)) {
      throw invalid('Invalid code_verifier');
    }
    if (!(await this.stores.grants.redeemCode(grant.id))) {
      // Lost a race against another request holding the same code. That is
      // the same theft signal as a replay, only caught a moment earlier.
      await this.revokeGrant(grant);
      throw invalid('Authorization code has already been used');
    }

    this.logger.log(`Issued tokens for client ${client.clientId}`);
    return this.tokensFor(grant, client);
  }

  private async refresh(request: TokenRequest): Promise<TokenResponse> {
    if (!request.refresh_token) {
      throw new OAuthError('invalid_request', 'refresh_token is required');
    }
    const invalid = (reason: string) => new OAuthError('invalid_grant', reason);
    const now = this.clock.now();

    const tokenHash = sha256(request.refresh_token);
    const stored = await this.stores.refreshTokens.find(tokenHash);
    if (!stored || stored.kind !== 'grant' || !stored.grantId) {
      throw invalid('Invalid refresh token');
    }
    const grant = await this.stores.grants.findById(stored.grantId);
    if (!grant || grant.status !== 'exchanged') {
      throw invalid('Invalid refresh token');
    }
    const client = await this.clientOf(grant);
    this.assertResourceMatches(grant, request);
    await this.authenticateClient(client, request);

    const reused = async () => {
      // Rotation means a revoked token is only ever seen again when it leaked
      await this.revokeGrant(grant);
      this.logger.warn(`Refresh token reuse detected for grant ${grant.id}`);
      return invalid('Refresh token has been revoked');
    };
    if (stored.revokedAt) {
      throw await reused();
    }
    if (now > stored.expiresAt) {
      throw invalid('Refresh token has expired');
    }
    return this.tokensFor(grant, client, async () => {
      // `revokedAt` above was read before this point, so two requests can
      // both get here with the same token. Only one consumes it; the other
      // is a reuse and has to be treated as one.
      if (!(await this.stores.refreshTokens.consume(tokenHash, now))) {
        throw await reused();
      }
    });
  }

  /**
   * Ends a grant: its refresh tokens are revoked and it can mint no more.
   * Marking the grant itself matters as much as revoking the tokens, because
   * it also stops a refresh token that a racing request stores afterwards.
   */
  private async revokeGrant(grant: Grant): Promise<void> {
    await this.stores.grants.save({ ...grant, status: 'revoked' });
    await this.stores.refreshTokens.revokeByGrant(grant.id, this.clock.now());
  }

  private async clientOf(grant: Grant): Promise<Client> {
    const client = await this.stores.clients.findByClientId(grant.clientId);
    if (!client) {
      throw new OAuthError('invalid_grant', 'The client of this grant no longer exists');
    }
    return client;
  }

  private authenticateClient(client: Client, request: TokenRequest): Promise<void> {
    // The audience of an assertion is the authorization server: its issuer
    // identifier, or the token endpoint as older clients send it.
    return this.clients.authenticate(client, request, [
      this.config.issuer,
      this.endpoints.token,
    ]);
  }

  /** An RFC 8707 `resource` in a token request must name the grant's resource */
  private assertResourceMatches(grant: Grant, request: TokenRequest): void {
    if (request.resource && !isSameResource(request.resource, grant.resource)) {
      throw new OAuthError(
        'invalid_target',
        'resource does not match the authorization request',
      );
    }
  }

  /**
   * Issues the tokens of a grant. `retireOld` consumes the refresh token being
   * rotated, and throws when it was already consumed.
   *
   * The order is what makes reuse detection hold under concurrency: the
   * replacement is stored before the old token is consumed. A request that
   * then loses the race on `consume` revokes the grant's tokens, and by that
   * time the winner's replacement is already in the store to be revoked.
   */
  private async tokensFor(
    grant: Grant,
    client: Client,
    retireOld?: () => Promise<void>,
  ): Promise<TokenResponse> {
    const subject = await this.subjectOf(grant.subjectId!);
    const refreshToken = client.grantTypes.includes('refresh_token')
      ? await this.storeRefreshToken({
          kind: 'grant',
          subjectId: subject.id,
          grantId: grant.id,
          clientId: client.clientId,
          ttlDays: this.config.refreshTokenTtlDays,
        })
      : undefined;
    await retireOld?.();

    const { token } = await this.mint({
      subject,
      // The audience is the resource the grant is bound to, never client input
      audience: grant.resource,
      scopes: grant.scopes,
      clientId: client.clientId,
      ttlSeconds: this.config.accessTokenTtlSeconds,
    });

    const response: TokenResponse = {
      access_token: token,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtlSeconds,
      scope: formatScope(grant.scopes),
    };
    if (refreshToken) {
      response.refresh_token = refreshToken;
    }
    return response;
  }

  private async storeRefreshToken(input: {
    kind: StoredRefreshToken['kind'];
    subjectId: string;
    grantId: string | null;
    clientId: string | null;
    ttlDays: number;
  }): Promise<string> {
    const token = randomToken();
    await this.stores.refreshTokens.store({
      tokenHash: sha256(token),
      kind: input.kind,
      subjectId: input.subjectId,
      grantId: input.grantId,
      clientId: input.clientId,
      expiresAt: new Date(
        this.clock.now().getTime() + input.ttlDays * DAY_SECONDS * 1000,
      ),
    });
    return token;
  }

  private async subjectOf(subjectId: string): Promise<Subject> {
    const subject = this.identity
      ? await this.identity.getSubject(subjectId)
      : { id: subjectId };
    if (!subject) {
      throw new OAuthError('invalid_grant', 'The user of this grant no longer exists');
    }
    return subject;
  }

  /** Builds the claims for a subject and signs them */
  private async mint(input: {
    subject: Subject;
    audience: string | string[];
    scopes: string[];
    clientId: string;
    ttlSeconds: number;
    claims?: Record<string, unknown>;
  }): Promise<SignedToken> {
    const { subject, audience, scopes, clientId } = input;
    const extra = await this.claims?.claimsFor(subject, {
      audience,
      clientId,
      scopes,
    });
    return this.signer.issue({
      subject: subject.id,
      audience,
      scopes,
      clientId,
      ttlSeconds: input.ttlSeconds,
      claims: {
        ...(subject.email ? { email: subject.email } : {}),
        ...(subject.displayName ? { name: subject.displayName } : {}),
        ...extra,
        ...input.claims,
      },
    });
  }

  // -------------------------------------------------------------- direct issue

  /**
   * Issues an access token directly, without a client or a consent step:
   * a token for an agent or a service. Pass `record` to make it listable
   * and revocable by its `jti`.
   */
  async issueToken(request: IssueTokenRequest): Promise<SignedToken> {
    const subject =
      typeof request.subject === 'string'
        ? await this.subjectOf(request.subject)
        : request.subject;
    if (request.record && !this.stores.issuedTokens) {
      throw new Error('Recording issued tokens needs stores.issuedTokens');
    }
    const signed = await this.mint({
      subject,
      audience: request.audience ?? this.config.issuer,
      scopes: request.scopes,
      clientId: request.clientId ?? 'issued-token',
      ttlSeconds: request.ttlSeconds,
      claims: {
        ...request.claims,
        ...(request.record?.issuedBy ? { issued_by: request.record.issuedBy } : {}),
      },
    });
    if (request.record) {
      await this.stores.issuedTokens!.record({
        jti: signed.jti,
        subjectId: subject.id,
        issuedBy: request.record.issuedBy ?? null,
        name: request.record.name,
        scopes: request.scopes,
        expiresAt: signed.expiresAt,
      });
    }
    return signed;
  }

  // -------------------------------------------------------------- introspect / revoke

  /** RFC 7662. An invalid, expired or revoked token is simply not active. */
  async introspect(input: {
    token?: string;
    client_id?: string;
  }): Promise<IntrospectionResult> {
    if (!input.token) {
      return { active: false };
    }
    let claims: AccessTokenClaims;
    try {
      claims = await this.verifier.verify(input.token);
    } catch {
      return { active: false };
    }
    if (input.client_id && claims.client_id !== input.client_id) {
      return { active: false };
    }
    return {
      ...claims,
      active: true,
      token_type: 'Bearer',
      scope: formatScope(parseScope(claims.scope)),
    };
  }

  /**
   * RFC 7009. Accepts a refresh token (revokes its whole grant) or an access
   * token (revokes its `jti`, when `stores.issuedTokens` is configured).
   * Never reveals whether the token existed.
   */
  async revoke(input: { token?: string }): Promise<void> {
    if (!input.token) {
      return;
    }
    const now = this.clock.now();
    const stored = await this.stores.refreshTokens.find(sha256(input.token));
    if (stored) {
      if (stored.grantId) {
        const grant = await this.stores.grants.findById(stored.grantId);
        if (grant) {
          await this.revokeGrant(grant);
        } else {
          await this.stores.refreshTokens.revokeByGrant(stored.grantId, now);
        }
      } else {
        await this.stores.refreshTokens.consume(stored.tokenHash, now);
      }
      return;
    }
    if (!this.stores.issuedTokens) {
      return;
    }
    try {
      const claims = await this.verifier.verify(input.token);
      await this.stores.issuedTokens.revoke(claims.jti, new Date(claims.exp * 1000));
    } catch {
      // Not a token of ours, or already unusable: nothing to revoke
    }
  }

  /** Revokes a recorded token by its `jti` */
  async revokeIssuedToken(jti: string): Promise<void> {
    if (!this.stores.issuedTokens) {
      throw new Error('Revoking issued tokens needs stores.issuedTokens');
    }
    await this.stores.issuedTokens.revoke(jti);
  }

  // -------------------------------------------------------------- sessions

  /** Email and password login. Returns a session token pair. */
  async login(input: { email: string; password: string }): Promise<SessionTokens> {
    if (!this.identity) {
      throw new Error('Login needs an identity provider');
    }
    if (!input.email || !input.password) {
      throw new InvalidCredentialsError();
    }
    return this.sessionFor(await this.identity.authenticate(input));
  }

  /** Exchanges a session refresh token for a new pair (rotation) */
  async refreshSession(refreshToken: string): Promise<SessionTokens> {
    const now = this.clock.now();
    const tokenHash = sha256(refreshToken);
    const stored = await this.stores.refreshTokens.find(tokenHash);
    if (!stored || stored.kind !== 'session') {
      throw new InvalidAccessTokenError('Invalid refresh token');
    }
    const reused = async () => {
      // A rotated token coming back means it leaked: end every session
      await this.stores.refreshTokens.revokeBySubject(stored.subjectId, 'session', now);
      this.logger.warn(`Session refresh token reuse detected for ${stored.subjectId}`);
      return new InvalidAccessTokenError('Refresh token revoked');
    };
    if (stored.revokedAt) {
      throw await reused();
    }
    if (now > stored.expiresAt) {
      throw new InvalidAccessTokenError('Refresh token expired');
    }
    const subject = await this.identity?.getSubject(stored.subjectId);
    if (!subject) {
      await this.stores.refreshTokens.consume(tokenHash, now);
      throw new InvalidAccessTokenError('Invalid refresh token');
    }
    return this.sessionFor(subject, async () => {
      // Two requests can both have read the token as live. The one that
      // fails to consume it is a reuse, with the same consequence as above.
      if (!(await this.stores.refreshTokens.consume(tokenHash, now))) {
        throw await reused();
      }
    });
  }

  /** Ends the session a refresh token belongs to */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.stores.refreshTokens.consume(sha256(refreshToken), this.clock.now());
    }
  }

  /**
   * The subject ID behind a session access token. Only tokens minted for a
   * browser session are accepted, so a token issued to a client or an agent
   * cannot be replayed as a logged-in user.
   */
  async resolveSession(accessToken: string): Promise<string> {
    const claims = await this.verifier.verify(accessToken);
    if (
      claims.aud !== this.config.sessionAudience ||
      claims.client_id !== this.config.sessionClientId
    ) {
      throw new InvalidAccessTokenError('Token is not a session token');
    }
    return claims.sub;
  }

  /**
   * Issues a session token pair. As in `tokensFor`, the new refresh token is
   * stored before `retireOld` consumes the one it replaces, so a request that
   * loses that race revokes a set of tokens that already includes it.
   */
  private async sessionFor(
    subject: Subject,
    retireOld?: () => Promise<void>,
  ): Promise<SessionTokens> {
    const ttlSeconds = this.config.sessionAccessTokenTtlSeconds;
    const refreshToken = await this.storeRefreshToken({
      kind: 'session',
      subjectId: subject.id,
      grantId: null,
      clientId: null,
      ttlDays: this.config.sessionRefreshTokenTtlDays,
    });
    await retireOld?.();
    const { token } = await this.mint({
      subject,
      audience: this.config.sessionAudience,
      scopes: await this.sessionScopes(subject),
      clientId: this.config.sessionClientId,
      ttlSeconds,
    });
    return {
      subject,
      accessToken: token,
      refreshToken,
      expiresInSeconds: ttlSeconds,
      refreshExpiresInSeconds: this.config.sessionRefreshTokenTtlDays * DAY_SECONDS,
    };
  }
}

/** The client's redirect URI with response parameters and the request's state */
function redirectWith(grant: Grant, params: Record<string, string>): string {
  const url = new URL(grant.redirectUri);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  if (grant.state !== null) {
    url.searchParams.set('state', grant.state);
  }
  return url.toString();
}

/** PKCE S256: BASE64URL(SHA256(verifier)) must equal the stored challenge */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash('sha256').update(codeVerifier).digest();
  const expected = Buffer.from(codeChallenge, 'base64url');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}
