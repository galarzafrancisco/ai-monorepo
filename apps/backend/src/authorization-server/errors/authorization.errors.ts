import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by Authorization Service
export const AuthorizationErrorCodes = {
  AUTH_FLOW_NOT_FOUND: ErrorCodes.AUTH_FLOW_NOT_FOUND,
  AUTH_FLOW_ALREADY_COMPLETED: ErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
  INVALID_FLOW_STATE: ErrorCodes.INVALID_FLOW_STATE,
  SERVER_IDENTIFIER_MISMATCH: ErrorCodes.SERVER_IDENTIFIER_MISMATCH,
  DOWNSTREAM_AUTH_FAILED: ErrorCodes.DOWNSTREAM_AUTH_FAILED,
  NO_PENDING_CONNECTION_FLOWS: ErrorCodes.NO_PENDING_CONNECTION_FLOWS,
  CONNECTION_FLOW_NOT_FOUND: ErrorCodes.CONNECTION_FLOW_NOT_FOUND,
  TOKEN_EXCHANGE_FAILED: ErrorCodes.TOKEN_EXCHANGE_FAILED,
  SERVER_NOT_FOUND: ErrorCodes.SERVER_NOT_FOUND,
  CLIENT_NOT_FOUND: ErrorCodes.CLIENT_NOT_FOUND,
  INVALID_REDIRECT_URI: ErrorCodes.INVALID_REDIRECT_URI,
} as const;

type AuthorizationErrorCode =
  typeof AuthorizationErrorCodes[keyof typeof AuthorizationErrorCodes];

/**
 * Base class for all Authorization domain errors
 * Keeps HTTP concerns out of the domain layer
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

export class AuthFlowNotFoundError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      'Authorization flow not found.',
      AuthorizationErrorCodes.AUTH_FLOW_NOT_FOUND,
      { flowId },
    );
  }
}

export class AuthFlowAlreadyCompletedError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      'Authorization flow has already been completed.',
      AuthorizationErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
      { flowId },
    );
  }
}

export class InvalidFlowStateError extends AuthorizationDomainError {
  constructor(reason: string) {
    super(
      `Invalid flow state: ${reason}`,
      AuthorizationErrorCodes.INVALID_FLOW_STATE,
      { reason },
    );
  }
}

export class ServerIdentifierMismatchError extends AuthorizationDomainError {
  constructor(expected: string, actual: string) {
    super(
      'Server identifier mismatch.',
      AuthorizationErrorCodes.SERVER_IDENTIFIER_MISMATCH,
      { expected, actual },
    );
  }
}

export class DownstreamAuthFailedError extends AuthorizationDomainError {
  constructor(reason: string) {
    super(
      `One or more downstream connections failed to authorize: ${reason}`,
      AuthorizationErrorCodes.DOWNSTREAM_AUTH_FAILED,
      { reason },
    );
  }
}

export class NoPendingConnectionFlowsError extends AuthorizationDomainError {
  constructor() {
    super(
      'No pending connection flows found.',
      AuthorizationErrorCodes.NO_PENDING_CONNECTION_FLOWS,
    );
  }
}

export class ConnectionFlowNotFoundError extends AuthorizationDomainError {
  constructor(state: string) {
    super(
      'Connection flow not found.',
      AuthorizationErrorCodes.CONNECTION_FLOW_NOT_FOUND,
      { state },
    );
  }
}

export class TokenExchangeFailedError extends AuthorizationDomainError {
  constructor(reason: string) {
    super(
      `Token exchange failed: ${reason}`,
      AuthorizationErrorCodes.TOKEN_EXCHANGE_FAILED,
      { reason },
    );
  }
}

export class McpServerNotFoundError extends AuthorizationDomainError {
  constructor(serverIdentifier: string) {
    super(
      'MCP server not found.',
      AuthorizationErrorCodes.SERVER_NOT_FOUND,
      { serverIdentifier },
    );
  }
}

export class McpClientNotFoundError extends AuthorizationDomainError {
  constructor(clientId: string) {
    super(
      'Client not found.',
      AuthorizationErrorCodes.CLIENT_NOT_FOUND,
      { clientId },
    );
  }
}

export class InvalidRedirectUriError extends AuthorizationDomainError {
  constructor(redirectUri: string, clientId: string) {
    super(
      'Redirect URI is not registered for this client.',
      AuthorizationErrorCodes.INVALID_REDIRECT_URI,
      { redirectUri, clientId },
    );
  }
}
