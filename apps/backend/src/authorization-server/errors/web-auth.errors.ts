import { ErrorCodes } from '@taico/errors';

export const WebAuthErrorCodes = {
  INTERNAL_ERROR: ErrorCodes.INTERNAL_ERROR,
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
