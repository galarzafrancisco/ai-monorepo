import { ErrorCodes } from "../../../../../packages/shared/errors/error-codes";

export const AccessTokenErrorCodes = {
  MISSING_ACCESS_TOKEN: ErrorCodes.MISSING_ACCESS_TOKEN,
  ACCESS_TOKEN_INVALID: ErrorCodes.ACCESS_TOKEN_INVALID,
}

type AccessTokenErrorCode =
  typeof AccessTokenErrorCodes[keyof typeof AccessTokenErrorCodes];

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
    super(
      'Missing access token',
      AccessTokenErrorCodes.MISSING_ACCESS_TOKEN,
    );
  }
}

/** Thrown when an access token is present but fails validation (expired, bad sig, etc.) */
export class InvalidAccessTokenError extends AccessTokenDomainError {
  constructor(
    message: string,
  ) {
    super(
      message,
      AccessTokenErrorCodes.ACCESS_TOKEN_INVALID,
    )
  }
}
