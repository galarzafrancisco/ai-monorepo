import type { Scope, Subject } from './types.js';

/*
 * Ports: what the package needs from its host. Pick an adapter
 * (`@taico/auth/memory`, `@taico/auth/typeorm`) or implement them yourself.
 * Identifiers of things the host owns (subjects, resources) are opaque strings.
 */

// ---------------------------------------------------------------- keys

export type NewKey = {
  kid: string;
  algorithm: string;
  publicKeyPem: string;
  privateKeyPem: string;
  /** When the key stops signing. It keeps verifying for a while after. */
  expiresAt: Date;
};

export type StoredKey = NewKey & { createdAt: Date };

export interface KeyStore {
  /** The key currently used for signing, if one exists and has not expired */
  findActive(now: Date): Promise<StoredKey | null>;
  /** Every key whose `expiresAt` is after `cutoff`, newest first */
  listVerifiable(cutoff: Date): Promise<StoredKey[]>;
  /** Stores `next` as the active key and retires the previous one */
  rotate(next: NewKey): Promise<StoredKey>;
}

// ---------------------------------------------------------------- clients

export type TokenEndpointAuthMethod = 'none' | 'private_key_jwt';
export type ClientRegistrationMethod =
  | 'dynamic_registration'
  | 'metadata_document'
  | 'static';

export type Client = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  registrationMethod: ClientRegistrationMethod;
  scopes: string[];
  contacts: string[] | null;
  /** Where a private_key_jwt client publishes its keys: a URL, or inline */
  jwksUri: string | null;
  jwks: { keys: Record<string, unknown>[] } | null;
  tokenEndpointAuthSigningAlg: string | null;
  /** Metadata document clients: when the cached document must be re-fetched */
  metadataExpiresAt: Date | null;
  createdAt: Date;
};

export interface ClientStore {
  findByClientId(clientId: string): Promise<Client | null>;
  /** Inserts or replaces the client with this `clientId` */
  save(client: Client): Promise<Client>;
}

// ---------------------------------------------------------------- grants

export type GrantStatus =
  | 'pending' // authorization requested, waiting for the user
  | 'approved' // user consented, code not issued yet (a hook may be running)
  | 'denied'
  | 'code_issued'
  | 'exchanged' // the code was redeemed for tokens
  | 'revoked';

/** One authorization: a user letting a client act on a resource */
export type Grant = {
  id: string;
  clientId: string;
  /** `ProtectedResource.id` */
  resourceId: string;
  /** Canonical resource URL, minted as the token audience */
  resource: string;
  scopes: string[];
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
  status: GrantStatus;
  subjectId: string | null;
  /** SHA-256 of the authorization code; the code itself is never stored */
  codeHash: string | null;
  codeExpiresAt: Date | null;
  createdAt: Date;
};

export type NewGrant = Omit<Grant, 'id' | 'createdAt'>;

export interface GrantStore {
  create(grant: NewGrant): Promise<Grant>;
  findById(id: string): Promise<Grant | null>;
  findByCodeHash(codeHash: string): Promise<Grant | null>;
  save(grant: Grant): Promise<Grant>;
  /**
   * Moves a grant from `code_issued` to `exchanged`, atomically. Returns false
   * when it was not in `code_issued`, which is how a code stays single-use
   * even when two requests race.
   */
  redeemCode(id: string): Promise<boolean>;
}

// ---------------------------------------------------------------- refresh tokens

export type RefreshTokenKind = 'grant' | 'session';

export type NewRefreshToken = {
  /** SHA-256 of the token; the token itself is never stored */
  tokenHash: string;
  kind: RefreshTokenKind;
  subjectId: string;
  /** Set for `grant` tokens */
  grantId: string | null;
  /**
   * Set for `session` tokens: the login this token descends from. Rotation
   * keeps it, and access tokens of the session carry it as their `sid` claim.
   */
  sessionId: string | null;
  clientId: string | null;
  expiresAt: Date;
};

export type StoredRefreshToken = NewRefreshToken & {
  revokedAt: Date | null;
};

export interface RefreshTokenStore {
  store(token: NewRefreshToken): Promise<void>;
  find(tokenHash: string): Promise<StoredRefreshToken | null>;
  /**
   * Revokes the token, atomically. Returns false when it was already revoked,
   * so a token cannot be rotated twice by two racing requests. The server
   * treats a false here as reuse and revokes the grant or the sessions, so
   * this must be a single conditional write, never a read followed by a write.
   */
  consume(tokenHash: string, now: Date): Promise<boolean>;
  /** Revokes every live token of a grant (reuse detected, or grant revoked) */
  revokeByGrant(grantId: string, now: Date): Promise<void>;
  /**
   * Revokes every live token of that kind of a subject (logout everywhere).
   * Returns the distinct `sessionId`s of the subject's tokens of that kind
   * that have not expired at `now`, revoked or not, so the server can also
   * revoke the access tokens of those sessions.
   */
  revokeBySubject(
    subjectId: string,
    kind: RefreshTokenKind,
    now: Date,
  ): Promise<string[]>;
}

// ---------------------------------------------------------------- issued tokens

/** A long-lived access token handed out directly, for example to an agent */
export type IssuedToken = {
  jti: string;
  subjectId: string;
  issuedBy: string | null;
  name: string | null;
  scopes: string[];
  expiresAt: Date;
};

export type StoredIssuedToken = IssuedToken & {
  revokedAt: Date | null;
  createdAt: Date;
};

/**
 * Answers whether an access token was revoked. Checked on every request.
 *
 * It is asked about two kinds of key: a token's `jti`, and, for a token that
 * carries a `sid` claim, `sessionRevocationKey(sid)`. The second is how a
 * whole grant or browser session is revoked at once, including access tokens
 * that were being minted while the revocation happened.
 */
export interface RevocationChecker {
  isRevoked(key: string): Promise<boolean>;
}

export interface IssuedTokenStore extends RevocationChecker {
  record(token: IssuedToken): Promise<void>;
  /**
   * Revokes a key: a token's `jti`, or a `sessionRevocationKey`. Must take
   * effect even when nothing was recorded under that key (short-lived tokens
   * and sessions are not), by storing a revoked entry. Must not fail when the
   * key is already revoked, including by a concurrent call.
   */
  revoke(key: string, expiresAt?: Date): Promise<void>;
  listBySubject(subjectId: string): Promise<StoredIssuedToken[]>;
}

// ---------------------------------------------------------------- host concepts

/** Something tokens are minted for: an API, an MCP server */
export type ProtectedResource = {
  id: string;
  /** Human-chosen identifier, usable in URLs */
  identifier: string;
  /** Canonical resource URL (RFC 8707); becomes the token audience */
  resourceUrl: string;
  name: string;
  scopes: Scope[];
};

export interface ResourceRegistry {
  /** Finds a resource by its `id`, its `identifier` or its `resourceUrl` */
  find(identifier: string): Promise<ProtectedResource | null>;
  /** Finds the resource served at this URL path, for RFC 9728 metadata */
  findByPath(path: string): Promise<ProtectedResource | null>;
}

export interface IdentityProvider {
  /** Returns the subject, or throws `InvalidCredentialsError` */
  authenticate(input: { email: string; password: string }): Promise<Subject>;
  getSubject(id: string): Promise<Subject | null>;
}

export type ClaimsContext = {
  audience: string | string[];
  clientId: string;
  scopes: string[];
};

/** Adds the host's own claims to every token minted for a subject */
export interface ClaimsProvider<Extra extends object = Record<string, unknown>> {
  claimsFor(subject: Subject, context: ClaimsContext): Promise<Extra>;
}

export type ConsentOutcome = { redirectTo: string } | { continue: true };

export interface AuthHooks {
  /**
   * Runs after the user approves and before the authorization code is issued.
   * Return `redirectTo` to send the user somewhere first (to connect a
   * downstream account, say); call `OAuthServer.completeAuthorization(grant.id)`
   * when they come back.
   */
  afterConsent?(grant: Grant): Promise<ConsentOutcome>;
}

/** Decides which scopes a browser session token carries */
export type SessionScopePolicy = (subject: Subject) => Promise<string[]> | string[];
