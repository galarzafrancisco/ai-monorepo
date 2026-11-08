import { ErrorCodes } from '@taico/errors';

// Module-scoped re-export of error codes used by Authorization Service
export const AuthorizationErrorCodes = {
  AUTH_FLOW_NOT_FOUND: ErrorCodes.AUTH_FLOW_NOT_FOUND,
  AUTH_FLOW_ALREADY_COMPLETED: ErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
  INVALID_FLOW_STATE: ErrorCodes.INVALID_FLOW_STATE,
  SERVER_IDENTIFIER_MISMATCH: ErrorCodes.SERVER_IDENTIFIER_MISMATCH,
  RESOURCE_MISMATCH: ErrorCodes.RESOURCE_MISMATCH,
  DOWNSTREAM_AUTH_FAILED: ErrorCodes.DOWNSTREAM_AUTH_FAILED,
  NO_PENDING_CONNECTION_FLOWS: ErrorCodes.NO_PENDING_CONNECTION_FLOWS,
  CONNECTION_FLOW_NOT_FOUND: ErrorCodes.CONNECTION_FLOW_NOT_FOUND,
  TOKEN_EXCHANGE_FAILED: ErrorCodes.TOKEN_EXCHANGE_FAILED,
  AUTHORIZATION_LINK_ALREADY_USED: ErrorCodes.AUTHORIZATION_LINK_ALREADY_USED,
  WORKER_ALREADY_AUTHORIZED: ErrorCodes.WORKER_ALREADY_AUTHORIZED,
  CONSENT_WORKSPACE_NOT_REQUESTED: ErrorCodes.CONSENT_WORKSPACE_NOT_REQUESTED,
  SERVER_NOT_FOUND: ErrorCodes.SERVER_NOT_FOUND,
  CLIENT_NOT_FOUND: ErrorCodes.CLIENT_NOT_FOUND,
  INVALID_REDIRECT_URI: ErrorCodes.INVALID_REDIRECT_URI,
} as const;

type AuthorizationErrorCode =
  (typeof AuthorizationErrorCodes)[keyof typeof AuthorizationErrorCodes];

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

/**
 * The person approved a consent screen that showed one workspace, but their
 * session is now in another (they switched in another tab). The token would
 * work somewhere they did not see, so the approval is refused.
 */
export class ConsentWorkspaceChangedError extends AuthorizationDomainError {
  constructor(shownWorkspaceId: string, sessionWorkspaceId: string | null) {
    super(
      'You switched workspace after this consent screen loaded. Reload it to review the request in your current workspace.',
      AuthorizationErrorCodes.INVALID_FLOW_STATE,
      { shownWorkspaceId, sessionWorkspaceId },
    );
  }
}

/**
 * An authorization request repeats the PKCE challenge of a flow that was
 * already approved or denied: someone opened an old authorization link again.
 * A client makes a new challenge for every authorization (RFC 7636), so this
 * is never a fresh request.
 */
export class AuthorizationLinkAlreadyUsedError extends AuthorizationDomainError {
  constructor(clientId: string) {
    super(
      'This authorization link was already used. Start the authorization again from the app that asked for it.',
      AuthorizationErrorCodes.AUTHORIZATION_LINK_ALREADY_USED,
      { clientId },
    );
  }
}

/**
 * A worker registers a new OAuth client every time it asks to be authorized,
 * so a worker client authorizes once. Approving it again (say, from another
 * workspace) would put the same worker in a second workspace.
 */
export class WorkerAlreadyAuthorizedError extends AuthorizationDomainError {
  constructor(clientId: string) {
    super(
      'This worker was already authorized. To connect a worker to another workspace, start another worker with --workspace <slug>.',
      AuthorizationErrorCodes.WORKER_ALREADY_AUTHORIZED,
      { clientId },
    );
  }
}

/**
 * The client asked for a token in one workspace (a worker started with
 * `--workspace`), but the person is approving from another.
 */
export class ConsentWorkspaceNotRequestedError extends AuthorizationDomainError {
  constructor(requestedWorkspaceSlug: string, sessionWorkspaceId: string | null) {
    super(
      `This request is for the workspace "${requestedWorkspaceSlug}". Switch to it to approve.`,
      AuthorizationErrorCodes.CONSENT_WORKSPACE_NOT_REQUESTED,
      { requestedWorkspaceSlug, sessionWorkspaceId },
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

/** Thrown when the RFC 8707 `resource` does not identify the MCP server being authorized */
export class ResourceMismatchError extends AuthorizationDomainError {
  constructor(expected: string, actual: string) {
    super(
      'Resource does not match the MCP server being authorized.',
      AuthorizationErrorCodes.RESOURCE_MISMATCH,
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
    super('MCP server not found.', AuthorizationErrorCodes.SERVER_NOT_FOUND, {
      serverIdentifier,
    });
  }
}

export class McpClientNotFoundError extends AuthorizationDomainError {
  constructor(clientId: string) {
    super('Client not found.', AuthorizationErrorCodes.CLIENT_NOT_FOUND, {
      clientId,
    });
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
