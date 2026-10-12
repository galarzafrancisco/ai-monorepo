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

/** Standard claims plus whatever the host's ClaimsProvider adds */
export type AccessTokenClaims<Extra extends object = Record<string, unknown>> =
  StandardClaims & Extra;

/** What a verified request is known to be acting as */
export type AuthContext<Extra extends object = Record<string, unknown>> = {
  token: string;
  claims: AccessTokenClaims<Extra>;
  scopes: string[];
  subject: string;
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
