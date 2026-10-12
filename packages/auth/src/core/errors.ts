import type { ScopeMode } from './scopes.js';

/**
 * Codes carried by request-authentication errors. The strings match the ones
 * in `@taico/errors`, so a host that maps errors by code needs no translation.
 */
export const AuthErrorCodes = {
  MISSING_ACCESS_TOKEN: 'MISSING_ACCESS_TOKEN',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN_SIGNATURE: 'INVALID_TOKEN_SIGNATURE',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

export type AuthErrorCode =
  (typeof AuthErrorCodes)[keyof typeof AuthErrorCodes];

/** Base of every error this package throws on purpose. Carries no HTTP types. */
export abstract class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** The request carries no access token */
export class MissingAccessTokenError extends AuthError {
  constructor() {
    super('Missing access token', AuthErrorCodes.MISSING_ACCESS_TOKEN);
  }
}

/** A token is present but cannot be accepted here */
export class InvalidAccessTokenError extends AuthError {
  constructor(message: string) {
    super(message, AuthErrorCodes.INVALID_ACCESS_TOKEN);
  }
}

/** The token is valid but lacks scopes the route needs */
export class InsufficientScopeError extends AuthError {
  constructor(
    readonly requiredScopes: string[],
    readonly mode: ScopeMode = 'all',
  ) {
    super(
      `Missing required scope(s): ${requiredScopes.join(', ')} (mode=${mode})`,
      AuthErrorCodes.INSUFFICIENT_SCOPE,
      { requiredScopes, mode },
    );
  }
}

/** Reasons a token fails verification, before any audience or scope check */
export class TokenExpiredError extends AuthError {
  constructor() {
    super('Token has expired.', AuthErrorCodes.TOKEN_EXPIRED);
  }
}

export class InvalidTokenSignatureError extends AuthError {
  constructor() {
    super('Invalid token signature.', AuthErrorCodes.INVALID_TOKEN_SIGNATURE);
  }
}

export class TokenRevokedError extends AuthError {
  constructor() {
    super('Token has been revoked.', AuthErrorCodes.TOKEN_REVOKED);
  }
}

export class TokenValidationError extends AuthError {
  constructor(message: string) {
    super(message, AuthErrorCodes.VALIDATION_FAILED);
  }
}

/** Email or password did not match. Deliberately says nothing more. */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password.', AuthErrorCodes.INVALID_CREDENTIALS);
  }
}

/**
 * A protocol error of the authorization server, in the shape OAuth defines
 * (RFC 6749 section 5.2): an error code from the spec plus a description.
 */
export class OAuthError extends AuthError {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description, `OAUTH_${error.toUpperCase()}`, { error });
  }

  toJSON(): { error: string; error_description: string } {
    return { error: this.error, error_description: this.description };
  }
}
