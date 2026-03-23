import { ErrorCodes } from '@taico/errors';

export const IdentityProviderErrorCodes = {
  USER_NOT_FOUND: ErrorCodes.USER_NOT_FOUND,
  USER_EMAIL_CONFLICT: ErrorCodes.USER_EMAIL_CONFLICT,
  USER_SLUG_CONFLICT: ErrorCodes.USER_SLUG_CONFLICT,
  PASSWORD_TOO_SHORT: ErrorCodes.PASSWORD_TOO_SHORT,
  ONBOARDING_NOT_ALLOWED: ErrorCodes.ONBOARDING_NOT_ALLOWED,
  INVALID_CREDENTIALS: ErrorCodes.INVALID_CREDENTIALS,
  INVALID_CURRENT_PASSWORD: ErrorCodes.INVALID_CURRENT_PASSWORD,
  INTERNAL_ERROR: ErrorCodes.INTERNAL_ERROR,
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

export class UserEmailConflictError extends IdentityProviderDomainError {
  constructor(email: string) {
    super(
      'A user with this email address already exists.',
      IdentityProviderErrorCodes.USER_EMAIL_CONFLICT,
      { email },
    );
  }
}

export class UserSlugConflictError extends IdentityProviderDomainError {
  constructor(slug: string) {
    super(
      'A user with this username already exists.',
      IdentityProviderErrorCodes.USER_SLUG_CONFLICT,
      { slug },
    );
  }
}

export class PasswordTooShortError extends IdentityProviderDomainError {
  constructor(minLength: number) {
    super(
      `Password must be at least ${minLength} characters long.`,
      IdentityProviderErrorCodes.PASSWORD_TOO_SHORT,
      { minLength },
    );
  }
}

export class OnboardingNotAllowedError extends IdentityProviderDomainError {
  constructor() {
    super(
      'Onboarding is not allowed because admin users already exist.',
      IdentityProviderErrorCodes.ONBOARDING_NOT_ALLOWED,
    );
  }
}

export class InvalidCredentialsError extends IdentityProviderDomainError {
  constructor() {
    super(
      'Invalid email or password.',
      IdentityProviderErrorCodes.INVALID_CREDENTIALS,
    );
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
