import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by Client Registration
export const ClientRegistrationErrorCodes = {
  CLIENT_ALREADY_REGISTERED: ErrorCodes.CLIENT_ALREADY_REGISTERED,
  CLIENT_NOT_FOUND: ErrorCodes.CLIENT_NOT_FOUND,
  INVALID_REDIRECT_URI: ErrorCodes.INVALID_REDIRECT_URI,
  INVALID_GRANT_TYPE: ErrorCodes.INVALID_GRANT_TYPE,
  INVALID_TOKEN_ENDPOINT_AUTH_METHOD:
    ErrorCodes.INVALID_TOKEN_ENDPOINT_AUTH_METHOD,
  MISSING_REQUIRED_FIELD: ErrorCodes.MISSING_REQUIRED_FIELD,
} as const;

type ClientRegistrationErrorCode =
  typeof ClientRegistrationErrorCodes[keyof typeof ClientRegistrationErrorCodes];

/**
 * Base class for all Client Registration domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class ClientRegistrationDomainError extends Error {
  constructor(
    message: string,
    readonly code: ClientRegistrationErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ClientNotFoundError extends ClientRegistrationDomainError {
  constructor(clientId: string) {
    super(
      'Client not found.',
      ClientRegistrationErrorCodes.CLIENT_NOT_FOUND,
      { clientId },
    );
  }
}

export class InvalidRedirectUriError extends ClientRegistrationDomainError {
  constructor(reason: string) {
    super(
      `Invalid redirect URI: ${reason}`,
      ClientRegistrationErrorCodes.INVALID_REDIRECT_URI,
      { reason },
    );
  }
}

export class InvalidGrantTypeError extends ClientRegistrationDomainError {
  constructor(reason: string) {
    super(
      `Invalid grant type configuration: ${reason}`,
      ClientRegistrationErrorCodes.INVALID_GRANT_TYPE,
      { reason },
    );
  }
}

export class InvalidTokenEndpointAuthMethodError extends ClientRegistrationDomainError {
  constructor(method: string) {
    super(
      `Invalid token endpoint authentication method: ${method}`,
      ClientRegistrationErrorCodes.INVALID_TOKEN_ENDPOINT_AUTH_METHOD,
      { method },
    );
  }
}

export class MissingRequiredFieldError extends ClientRegistrationDomainError {
  constructor(fieldName: string) {
    super(
      `Missing required field: ${fieldName}`,
      ClientRegistrationErrorCodes.MISSING_REQUIRED_FIELD,
      { fieldName },
    );
  }
}
