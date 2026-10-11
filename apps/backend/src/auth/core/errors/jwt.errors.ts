import { ErrorCodes } from '@taico/errors';

// Module-scoped re-export of error codes used by JWT Service
export const JWTErrorCodes = {
  TOKEN_EXPIRED: ErrorCodes.TOKEN_EXPIRED,
  INVALID_TOKEN_SIGNATURE: ErrorCodes.INVALID_TOKEN_SIGNATURE,
  VALIDATION_FAILED: ErrorCodes.VALIDATION_FAILED,
  INVALID_ACCESS_TOKEN: ErrorCodes.INVALID_ACCESS_TOKEN,
} as const;

type JWTErrorCode = (typeof JWTErrorCodes)[keyof typeof JWTErrorCodes];

/**
 * Base class for all Token domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class TokenDomainError extends Error {
  constructor(
    message: string,
    readonly code: JWTErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TokenExpiredError extends TokenDomainError {
  constructor() {
    super('Token has expired.', JWTErrorCodes.TOKEN_EXPIRED);
  }
}

export class InvalidTokenSignaturedError extends TokenDomainError {
  constructor() {
    super('Invalid token signature.', JWTErrorCodes.INVALID_TOKEN_SIGNATURE);
  }
}

export class TokenValidationError extends TokenDomainError {
  constructor(message: string) {
    super(message, JWTErrorCodes.VALIDATION_FAILED);
  }
}

/** Thrown when a token that is not a web session token is used as a session cookie */
export class NotSessionTokenError extends TokenDomainError {
  constructor() {
    super(
      'Token is not a web session token.',
      JWTErrorCodes.INVALID_ACCESS_TOKEN,
    );
  }
}
