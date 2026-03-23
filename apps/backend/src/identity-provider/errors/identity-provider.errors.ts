import { ErrorCodes } from '@taico/errors';

// Module-scoped re-export of error codes used by Identity Provider
export const IdentityProviderErrorCodes = {
  USER_NOT_FOUND: ErrorCodes.USER_NOT_FOUND,
  INVALID_CREDENTIALS: ErrorCodes.INVALID_CREDENTIALS,
  INVALID_CURRENT_PASSWORD: ErrorCodes.INVALID_CURRENT_PASSWORD,
} as const;

type IdentityProviderErrorCode =
  (typeof IdentityProviderErrorCodes)[keyof typeof IdentityProviderErrorCodes];

/**
 * Base class for all Identity Provider domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class IdentityProviderDomainError extends Error {
  constructor(
    message: string,
    readonly code: IdentityProviderErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserNotFoundError extends IdentityProviderDomainError {
  constructor(userId: string) {
    super('User not found.', IdentityProviderErrorCodes.USER_NOT_FOUND, {
      userId,
    });
  }
}

export class InvalidCredentialsError extends IdentityProviderDomainError {
  constructor() {
    super('Invalid credentials', IdentityProviderErrorCodes.INVALID_CREDENTIALS);
  }
}

export class InvalidCurrentPasswordError extends IdentityProviderDomainError {
  constructor() {
    super(
      'Current password is incorrect',
      IdentityProviderErrorCodes.INVALID_CURRENT_PASSWORD,
    );
  }
}
