import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by Token Service
export const TokenErrorCodes = {
  INVALID_GRANT_TYPE: ErrorCodes.INVALID_GRANT_TYPE,
  MISSING_REQUIRED_FIELD: ErrorCodes.MISSING_REQUIRED_FIELD,
  INVALID_AUTHORIZATION_CODE: ErrorCodes.INVALID_AUTHORIZATION_CODE,
  CLIENT_ID_MISMATCH: ErrorCodes.CLIENT_ID_MISMATCH,
  AUTHORIZATION_CODE_USED: ErrorCodes.AUTHORIZATION_CODE_USED,
  AUTHORIZATION_CODE_EXPIRED: ErrorCodes.AUTHORIZATION_CODE_EXPIRED,
  REDIRECT_URI_MISMATCH: ErrorCodes.REDIRECT_URI_MISMATCH,
  MISSING_PKCE_PARAMETERS: ErrorCodes.MISSING_PKCE_PARAMETERS,
  INVALID_CODE_VERIFIER: ErrorCodes.INVALID_CODE_VERIFIER,
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

export class InvalidGrantTypeError extends TokenDomainError {
  constructor(grantType: string) {
    super(
      'Invalid grant_type.',
      TokenErrorCodes.INVALID_GRANT_TYPE,
      { grantType },
    );
  }
}

export class MissingRequiredParametersError extends TokenDomainError {
  constructor(grantType: string) {
    super(
      `Missing required parameters for ${grantType} grant.`,
      TokenErrorCodes.MISSING_REQUIRED_FIELD,
      { grantType },
    );
  }
}

export class InvalidAuthorizationCodeError extends TokenDomainError {
  constructor(code: string) {
    super(
      'Invalid authorization code.',
      TokenErrorCodes.INVALID_AUTHORIZATION_CODE,
      { code },
    );
  }
}

export class ClientIdMismatchError extends TokenDomainError {
  constructor() {
    super(
      'Client ID mismatch.',
      TokenErrorCodes.CLIENT_ID_MISMATCH,
    );
  }
}

export class AuthorizationCodeUsedError extends TokenDomainError {
  constructor() {
    super(
      'Authorization code has already been used.',
      TokenErrorCodes.AUTHORIZATION_CODE_USED,
    );
  }
}

export class AuthorizationCodeExpiredError extends TokenDomainError {
  constructor() {
    super(
      'Authorization code has expired.',
      TokenErrorCodes.AUTHORIZATION_CODE_EXPIRED,
    );
  }
}

export class RedirectUriMismatchError extends TokenDomainError {
  constructor() {
    super(
      'Redirect URI mismatch.',
      TokenErrorCodes.REDIRECT_URI_MISMATCH,
    );
  }
}

export class MissingPkceParametersError extends TokenDomainError {
  constructor() {
    super(
      'Missing PKCE parameters.',
      TokenErrorCodes.MISSING_PKCE_PARAMETERS,
    );
  }
}

export class InvalidCodeVerifierError extends TokenDomainError {
  constructor() {
    super(
      'Invalid code_verifier.',
      TokenErrorCodes.INVALID_CODE_VERIFIER,
    );
  }
}
