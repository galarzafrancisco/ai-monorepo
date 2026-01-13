import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by both auth and authorization-server
export const TokenErrorCodes = {
  TOKEN_EXPIRED: ErrorCodes.TOKEN_EXPIRED,
  INVALID_TOKEN_SIGNATURE: ErrorCodes.INVALID_TOKEN_SIGNATURE,
  VALIDATION_FAILED: ErrorCodes.VALIDATION_FAILED,
} as const;

type TokenErrorCode =
  typeof TokenErrorCodes[keyof typeof TokenErrorCodes];

/**
 * Base class for all Token domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class TokenDomainError extends Error {
  constructor(
    message: string,
    readonly code: TokenErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TokenExpiredError extends TokenDomainError {
  constructor() {
    super(
      'Token has expired.',
      TokenErrorCodes.TOKEN_EXPIRED,
    );
  }
}

export class InvalidTokenSignaturedError extends TokenDomainError {
  constructor() {
    super(
      'Invalid token signature.',
      TokenErrorCodes.INVALID_TOKEN_SIGNATURE,
    );
  }
}

export class TokenValidationError extends TokenDomainError {
  constructor(message: string) {
    super(
      message,
      TokenErrorCodes.VALIDATION_FAILED,
    );
  }
}
