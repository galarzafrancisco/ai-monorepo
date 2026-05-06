export class InvalidTokenError extends Error {
  constructor(message = 'Invalid access token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class InsufficientScopeError extends Error {
  constructor(public readonly requiredScopes: string[]) {
    super(`Missing required scopes: ${requiredScopes.join(', ')}`);
    this.name = 'InsufficientScopeError';
  }
}

export class RequireScopesError extends InsufficientScopeError {}

export class UnknownDownstreamConnectionError extends Error {
  constructor(connection: string) {
    super(`Unknown downstream connection: ${connection}`);
    this.name = 'UnknownDownstreamConnectionError';
  }
}

export class DownstreamTokenUnavailableError extends Error {
  constructor(connection: string) {
    super(`No downstream token exchange is configured for connection: ${connection}`);
    this.name = 'DownstreamTokenUnavailableError';
  }
}
