import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const AuthorizationErrorCodes = {
  SERVER_NOT_FOUND: ErrorCodes.SERVER_NOT_FOUND,
  CLIENT_NOT_FOUND: ErrorCodes.CLIENT_NOT_FOUND,
  INVALID_REDIRECT_URI: ErrorCodes.INVALID_REDIRECT_URI,
  AUTH_FLOW_NOT_FOUND: ErrorCodes.AUTH_FLOW_NOT_FOUND,
  AUTH_FLOW_ALREADY_COMPLETED: ErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
  SERVER_IDENTIFIER_MISMATCH: ErrorCodes.SERVER_IDENTIFIER_MISMATCH,
  INVALID_FLOW_STATE: ErrorCodes.INVALID_FLOW_STATE,
  DOWNSTREAM_AUTH_FAILED: ErrorCodes.DOWNSTREAM_AUTH_FAILED,
  NO_PENDING_CONNECTION_FLOWS: ErrorCodes.NO_PENDING_CONNECTION_FLOWS,
  MISSING_REDIRECT_URI_OR_STATE: ErrorCodes.MISSING_REDIRECT_URI_OR_STATE,
  CONNECTION_FLOW_NOT_FOUND: ErrorCodes.CONNECTION_FLOW_NOT_FOUND,
  TOKEN_EXCHANGE_FAILED: ErrorCodes.TOKEN_EXCHANGE_FAILED,
  INVALID_AUTHORIZATION_CODE: ErrorCodes.INVALID_AUTHORIZATION_CODE,
  CLIENT_ID_MISMATCH: ErrorCodes.CLIENT_ID_MISMATCH,
  AUTHORIZATION_CODE_USED: ErrorCodes.AUTHORIZATION_CODE_USED,
  AUTHORIZATION_CODE_EXPIRED: ErrorCodes.AUTHORIZATION_CODE_EXPIRED,
  REDIRECT_URI_MISMATCH: ErrorCodes.REDIRECT_URI_MISMATCH,
  PKCE_PARAMETERS_MISSING: ErrorCodes.PKCE_PARAMETERS_MISSING,
  INVALID_CODE_VERIFIER: ErrorCodes.INVALID_CODE_VERIFIER,
  TOKEN_REQUEST_PARAMETERS_MISSING: ErrorCodes.TOKEN_REQUEST_PARAMETERS_MISSING,
  INVALID_GRANT_TYPE: ErrorCodes.INVALID_GRANT_TYPE,
} as const;

type AuthorizationErrorCode =
  typeof AuthorizationErrorCodes[keyof typeof AuthorizationErrorCodes];

/**
 * Base class for all Authorization domain errors.
 * Keeps HTTP concerns out of the service layer.
 */
export abstract class AuthorizationDomainError extends Error {
  constructor(
    message: string,
    readonly code: AuthorizationErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthorizationMcpServerNotFoundError extends AuthorizationDomainError {
  constructor(serverIdentifier: string) {
    super(
      `MCP server with identifier '${serverIdentifier}' was not found.`,
      AuthorizationErrorCodes.SERVER_NOT_FOUND,
      { serverIdentifier },
    );
  }
}

export class AuthorizationClientNotFoundError extends AuthorizationDomainError {
  constructor(clientId: string) {
    super(
      `Client '${clientId}' was not found.`,
      AuthorizationErrorCodes.CLIENT_NOT_FOUND,
      { clientId },
    );
  }
}

export class RedirectUriNotRegisteredError extends AuthorizationDomainError {
  constructor(clientId: string, redirectUri: string) {
    super(
      `Redirect URI '${redirectUri}' is not registered for client '${clientId}'.`,
      AuthorizationErrorCodes.INVALID_REDIRECT_URI,
      { clientId, redirectUri },
    );
  }
}

export class AuthorizationFlowNotFoundError extends AuthorizationDomainError {
  constructor(context: {
    flowId?: string;
    clientId?: string;
    serverIdentifier?: string;
    journeyId?: string;
  }) {
    super(
      AuthorizationFlowNotFoundError.buildMessage(context),
      AuthorizationErrorCodes.AUTH_FLOW_NOT_FOUND,
      context,
    );
  }

  private static buildMessage(context: {
    flowId?: string;
    clientId?: string;
    serverIdentifier?: string;
    journeyId?: string;
  }): string {
    if (context.flowId && context.clientId && context.serverIdentifier) {
      return `Authorization flow for client '${context.clientId}' and server '${context.serverIdentifier}' was not found.`;
    }

    if (context.flowId) {
      return `Authorization flow '${context.flowId}' was not found.`;
    }

    if (context.clientId && context.serverIdentifier) {
      return `Authorization flow for client '${context.clientId}' and server '${context.serverIdentifier}' was not found.`;
    }

    if (context.journeyId) {
      return `Authorization flow for journey '${context.journeyId}' was not found.`;
    }

    return 'Authorization flow was not found.';
  }
}

export class AuthorizationFlowAlreadyCompletedError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      `Authorization flow '${flowId}' has already been completed.`,
      AuthorizationErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
      { flowId },
    );
  }
}

export class ServerIdentifierMismatchError extends AuthorizationDomainError {
  constructor(expectedIdentifier: string, receivedIdentifier: string) {
    super(
      'Server identifier mismatch.',
      AuthorizationErrorCodes.SERVER_IDENTIFIER_MISMATCH,
      { expectedIdentifier, receivedIdentifier },
    );
  }
}

export class InvalidFlowStateError extends AuthorizationDomainError {
  constructor(flowId: string, missingFields: string[]) {
    super(
      `Authorization flow '${flowId}' is missing required state: ${missingFields.join(', ')}.`,
      AuthorizationErrorCodes.INVALID_FLOW_STATE,
      { flowId, missingFields },
    );
  }
}

export class DownstreamAuthorizationFailedError extends AuthorizationDomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      message,
      AuthorizationErrorCodes.DOWNSTREAM_AUTH_FAILED,
      context,
    );
  }
}

export class NoPendingConnectionFlowsError extends AuthorizationDomainError {
  constructor(journeyId: string) {
    super(
      `No pending connection flows were found for journey '${journeyId}'.`,
      AuthorizationErrorCodes.NO_PENDING_CONNECTION_FLOWS,
      { journeyId },
    );
  }
}

export class MissingRedirectUriOrStateError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      `Authorization flow '${flowId}' is missing redirect URI or state.`,
      AuthorizationErrorCodes.MISSING_REDIRECT_URI_OR_STATE,
      { flowId },
    );
  }
}

export class ConnectionFlowNotFoundError extends AuthorizationDomainError {
  constructor(context: { state?: string; connectionFlowId?: string }) {
    super(
      context.state
        ? `Connection authorization flow with state '${context.state}' was not found.`
        : 'Connection authorization flow was not found.',
      AuthorizationErrorCodes.CONNECTION_FLOW_NOT_FOUND,
      context,
    );
  }
}

export class TokenExchangeFailedError extends AuthorizationDomainError {
  constructor(details: string) {
    super(
      `Downstream token exchange failed: ${details}`,
      AuthorizationErrorCodes.TOKEN_EXCHANGE_FAILED,
      { details },
    );
  }
}

export class InvalidGrantTypeForTokenError extends AuthorizationDomainError {
  constructor(grantType: string) {
    super(
      `Grant type '${grantType}' is not supported for this endpoint.`,
      AuthorizationErrorCodes.INVALID_GRANT_TYPE,
      { grantType },
    );
  }
}

export class TokenRequestParametersMissingError extends AuthorizationDomainError {
  constructor(missingParameters: string[]) {
    super(
      `Token request is missing required parameters: ${missingParameters.join(', ')}.`,
      AuthorizationErrorCodes.TOKEN_REQUEST_PARAMETERS_MISSING,
      { missingParameters },
    );
  }
}

export class InvalidAuthorizationCodeError extends AuthorizationDomainError {
  constructor(code: string) {
    super(
      'Authorization code is invalid.',
      AuthorizationErrorCodes.INVALID_AUTHORIZATION_CODE,
      { code },
    );
  }
}

export class ClientIdMismatchError extends AuthorizationDomainError {
  constructor(expectedClientId: string, providedClientId: string) {
    super(
      'Client ID does not match authorization request.',
      AuthorizationErrorCodes.CLIENT_ID_MISMATCH,
      { expectedClientId, providedClientId },
    );
  }
}

export class AuthorizationCodeAlreadyUsedError extends AuthorizationDomainError {
  constructor(code: string) {
    super(
      'Authorization code has already been used.',
      AuthorizationErrorCodes.AUTHORIZATION_CODE_USED,
      { code },
    );
  }
}

export class AuthorizationCodeExpiredError extends AuthorizationDomainError {
  constructor(code: string, expiresAt?: Date) {
    super(
      'Authorization code has expired.',
      AuthorizationErrorCodes.AUTHORIZATION_CODE_EXPIRED,
      { code, expiresAt },
    );
  }
}

export class RedirectUriMismatchError extends AuthorizationDomainError {
  constructor(expectedRedirectUri: string, providedRedirectUri: string) {
    super(
      'Redirect URI does not match authorization request.',
      AuthorizationErrorCodes.REDIRECT_URI_MISMATCH,
      { expectedRedirectUri, providedRedirectUri },
    );
  }
}

export class PkceParametersMissingError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      `PKCE parameters are missing for authorization flow '${flowId}'.`,
      AuthorizationErrorCodes.PKCE_PARAMETERS_MISSING,
      { flowId },
    );
  }
}

export class InvalidCodeVerifierError extends AuthorizationDomainError {
  constructor() {
    super(
      'Provided code verifier is invalid.',
      AuthorizationErrorCodes.INVALID_CODE_VERIFIER,
    );
  }
}
