export class AuthorizationServerError extends Error {
  constructor(message: string, readonly code: string, readonly statusCode = 400) {
    super(message);
  }
}

export class InvalidTokenError extends AuthorizationServerError {
  constructor(message = 'Invalid token') {
    super(message, 'invalid_token', 401);
  }
}

export class InsufficientScopeError extends AuthorizationServerError {
  constructor(message = 'Insufficient scope') {
    super(message, 'insufficient_scope', 403);
  }
}

export class RequireScopesError extends InsufficientScopeError {}

export class InvalidClientError extends AuthorizationServerError {
  constructor(message = 'Invalid client') {
    super(message, 'invalid_client', 401);
  }
}
