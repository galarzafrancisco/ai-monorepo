import { ErrorCodes } from '@taico/errors';

export const AccessTokenErrorCodes = {
  MISSING_ACCESS_TOKEN: ErrorCodes.MISSING_ACCESS_TOKEN,
  INVALID_ACCESS_TOKEN: ErrorCodes.INVALID_ACCESS_TOKEN,
  INSUFFICIENT_SCOPE: ErrorCodes.INSUFFICIENT_SCOPE,
};

type AccessTokenErrorCode =
  (typeof AccessTokenErrorCodes)[keyof typeof AccessTokenErrorCodes];

/**
 * Base class for all Token domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class AccessTokenDomainError extends Error {
  constructor(
    message: string,
    readonly code: AccessTokenErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Thrown when the request contains no usable access token */
export class MissingAccessTokenError extends AccessTokenDomainError {
  constructor() {
    super('Missing access token', AccessTokenErrorCodes.MISSING_ACCESS_TOKEN);
  }
}

/** Thrown when an access token is present but fails validation (expired, bad sig, etc.) */
export class InvalidAccessTokenError extends AccessTokenDomainError {
  constructor(message: string) {
    super(message, AccessTokenErrorCodes.INVALID_ACCESS_TOKEN);
  }
}

/** Thrown when the access token is valid but lacks required scopes */
export class InsufficientScopeError extends AccessTokenDomainError {
  constructor(message: string) {
    super(message, AccessTokenErrorCodes.INSUFFICIENT_SCOPE);
  }
}
