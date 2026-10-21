/** A permission an access token can carry */
export type Scope = {
  id: string;
  description: string;
};

/**
 * Claims every access token issued by this package carries (RFC 9068).
 * `scope` is a space-delimited string. Tokens written before that convention
 * may carry an array instead; read scopes with `parseScope`, never directly.
 */
export interface StandardClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  jti: string;
  client_id: string;
  scope: string;
  /**
   * The grant or browser session the token was issued under. Revoking that
   * grant or session revokes the token. Directly issued tokens have none.
   */
  sid?: string;
}

/**
 * Identity claims with their OpenID Connect names, for a `ClaimsProvider`
 * that describes the user. All optional: none are added by default.
 *
 * resourceServer.authenticate<IdentityClaims>(...)
 */
export interface IdentityClaims {
  name?: string;
  email?: string;
  preferred_username?: string;
}

/**
 * The claims a Taico server puts in its access tokens, beyond the standard
 * ones. Read them with `authenticate<TaicoClaims>(...)`. They describe who
 * the user is, not what they may do: scopes record what the user approved.
 */
export interface TaicoClaims {
  /** UUID of the Taico actor (also `sub`) */
  actor_id: string;
  actor_slug: string;
  actor_type: 'human' | 'agent';
  email?: string;
  displayName?: string;
  /** The MCP server the token was issued for, on MCP tokens */
  mcp_server_identifier?: string;
  /** The resource URL the token was issued for (also `aud`) */
  resource?: string;
  version?: string;
  /** Actor that issued the token by hand, on manually issued tokens */
  issued_by?: string;
}

/** Standard claims plus whatever the host's ClaimsProvider adds */
export type AccessTokenClaims<Extra extends object = Record<string, unknown>> =
  StandardClaims & Extra;

/**
 * What a verified request is known to be acting as.
 *
 * It is also a valid `AuthInfo` of the MCP TypeScript SDK (`token`,
 * `clientId`, `scopes`, `expiresAt`, `resource`, `extra`), because both put
 * it on `req.auth`: an MCP transport reads the context this package set,
 * so it can be handed over without converting.
 */
export type AuthContext<Extra extends object = Record<string, unknown>> = {
  token: string;
  claims: AccessTokenClaims<Extra>;
  scopes: string[];
  subject: string;
  /** The OAuth client the token was issued to (`client_id`, else `azp`; empty if neither) */
  clientId: string;
  /** Expiry of the token, in seconds since the epoch (`exp`) */
  expiresAt?: number;
  /** The protected resource this request was accepted for, when it is known */
  resource?: URL;
  /** `sub` and the claims again, for consumers that only read `AuthInfo` */
  extra: { subject: string; claims: AccessTokenClaims<Extra> };
};

/** A user or other principal, as the host's identity provider describes it */
export type Subject = {
  id: string;
  email?: string;
  displayName?: string;
  [attribute: string]: unknown;
};

export interface Logger {
  debug(message: string): void;
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const silentLogger: Logger = {
  debug() {},
  log() {},
  warn() {},
  error() {},
};
