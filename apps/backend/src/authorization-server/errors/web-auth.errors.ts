import { ErrorCodes } from '@taico/errors';

export const WebAuthErrorCodes = {
  INTERNAL_ERROR: ErrorCodes.INTERNAL_ERROR,
  INVALID_REFRESH_TOKEN: ErrorCodes.INVALID_REFRESH_TOKEN,
  REFRESH_TOKEN_EXPIRED: ErrorCodes.REFRESH_TOKEN_EXPIRED,
  REFRESH_TOKEN_REVOKED: ErrorCodes.REFRESH_TOKEN_REVOKED,
} as const;

type WebAuthErrorCode =
  (typeof WebAuthErrorCodes)[keyof typeof WebAuthErrorCodes];

/**
 * Base class for all Web Auth domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class WebAuthDomainError extends Error {
  constructor(
    message: string,
    readonly code: WebAuthErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class RefreshTokenUserMissingError extends WebAuthDomainError {
  constructor(refreshTokenId: string) {
    super('User not found for refresh token.', WebAuthErrorCodes.INTERNAL_ERROR, {
      refreshTokenId,
    });
  }
}

export class RefreshTokenActorMissingError extends WebAuthDomainError {
  constructor(refreshTokenId: string) {
    super(
      'Actor not found for refresh token.',
      WebAuthErrorCodes.INTERNAL_ERROR,
      { refreshTokenId },
    );
  }
}

export class InvalidWebRefreshTokenError extends WebAuthDomainError {
  constructor() {
    super(
      'Invalid refresh token.',
      WebAuthErrorCodes.INVALID_REFRESH_TOKEN,
    );
  }
}

export class WebRefreshTokenExpiredError extends WebAuthDomainError {
  constructor() {
    super(
      'Refresh token has expired.',
      WebAuthErrorCodes.REFRESH_TOKEN_EXPIRED,
    );
  }
}

export class WebRefreshTokenRevokedError extends WebAuthDomainError {
  constructor() {
    super(
      'Refresh token has been revoked.',
      WebAuthErrorCodes.REFRESH_TOKEN_REVOKED,
    );
  }
}
