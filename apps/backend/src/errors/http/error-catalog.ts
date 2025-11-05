import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const ErrorCatalog: Record<
  string,
  {
    status: number;
    title: string;
    type: string;
    retryable?: boolean;
  }
> = {
  [ErrorCodes.TASK_NOT_FOUND]: {
    status: 404,
    title: 'Task not found',
    type: '/errors/tasks/not-found',
    retryable: false,
  },
  [ErrorCodes.TASK_NOT_ASSIGNED]: {
    status: 400,
    title: 'Task not assigned',
    type: '/errors/tasks/not-assigned',
    retryable: false,
  },
  [ErrorCodes.INVALID_STATUS_TRANSITION]: {
    status: 400,
    title: 'Invalid status transition',
    type: '/errors/tasks/invalid-status-transition',
    retryable: false,
  },
  [ErrorCodes.COMMENT_REQUIRED]: {
    status: 400,
    title: 'Comment required',
    type: '/errors/tasks/comment-required',
    retryable: false,
  },
  [ErrorCodes.PAGE_NOT_FOUND]: {
    status: 404,
    title: 'Wiki page not found',
    type: '/errors/wiki/page-not-found',
    retryable: false,
  },
  [ErrorCodes.CLIENT_ALREADY_REGISTERED]: {
    status: 409,
    title: 'Client already registered',
    type: '/errors/authz/client-already-registered',
    retryable: false,
  },
  [ErrorCodes.CLIENT_NOT_FOUND]: {
    status: 404,
    title: 'Client not found',
    type: '/errors/authz/client-not-found',
    retryable: false,
  },
  [ErrorCodes.INVALID_REDIRECT_URI]: {
    status: 400,
    title: 'Invalid redirect URI',
    type: '/errors/authz/invalid-redirect-uri',
    retryable: false,
  },
  [ErrorCodes.INVALID_GRANT_TYPE]: {
    status: 400,
    title: 'Invalid grant type',
    type: '/errors/authz/invalid-grant-type',
    retryable: false,
  },
  [ErrorCodes.INVALID_TOKEN_ENDPOINT_AUTH_METHOD]: {
    status: 400,
    title: 'Invalid token endpoint authentication method',
    type: '/errors/authz/invalid-token-endpoint-auth-method',
    retryable: false,
  },
  [ErrorCodes.PKCE_REQUIRED]: {
    status: 400,
    title: 'PKCE required',
    type: '/errors/authz/pkce-required',
    retryable: false,
  },
  [ErrorCodes.MISSING_REQUIRED_FIELD]: {
    status: 400,
    title: 'Missing required field',
    type: '/errors/authz/missing-required-field',
    retryable: false,
  },
  [ErrorCodes.SERVER_NOT_FOUND]: {
    status: 404,
    title: 'MCP server not found',
    type: '/errors/mcp/server-not-found',
    retryable: false,
  },
  [ErrorCodes.SERVER_ALREADY_EXISTS]: {
    status: 409,
    title: 'MCP server already exists',
    type: '/errors/mcp/server-already-exists',
    retryable: false,
  },
  [ErrorCodes.SCOPE_NOT_FOUND]: {
    status: 404,
    title: 'MCP scope not found',
    type: '/errors/mcp/scope-not-found',
    retryable: false,
  },
  [ErrorCodes.SCOPE_ALREADY_EXISTS]: {
    status: 409,
    title: 'MCP scope already exists',
    type: '/errors/mcp/scope-already-exists',
    retryable: false,
  },
  [ErrorCodes.CONNECTION_NOT_FOUND]: {
    status: 404,
    title: 'MCP connection not found',
    type: '/errors/mcp/connection-not-found',
    retryable: false,
  },
  [ErrorCodes.CONNECTION_NAME_CONFLICT]: {
    status: 409,
    title: 'Connection name conflict',
    type: '/errors/mcp/connection-name-conflict',
    retryable: false,
  },
  [ErrorCodes.MAPPING_NOT_FOUND]: {
    status: 404,
    title: 'MCP mapping not found',
    type: '/errors/mcp/mapping-not-found',
    retryable: false,
  },
  [ErrorCodes.SERVER_HAS_DEPENDENCIES]: {
    status: 409,
    title: 'Server has dependencies',
    type: '/errors/mcp/server-has-dependencies',
    retryable: false,
  },
  [ErrorCodes.SCOPE_HAS_MAPPINGS]: {
    status: 409,
    title: 'Scope has mappings',
    type: '/errors/mcp/scope-has-mappings',
    retryable: false,
  },
  [ErrorCodes.CONNECTION_HAS_MAPPINGS]: {
    status: 409,
    title: 'Connection has mappings',
    type: '/errors/mcp/connection-has-mappings',
    retryable: false,
  },
  [ErrorCodes.INVALID_MAPPING]: {
    status: 400,
    title: 'Invalid mapping',
    type: '/errors/mcp/invalid-mapping',
    retryable: false,
  },
  [ErrorCodes.VALIDATION_FAILED]: {
    status: 400,
    title: 'Validation failed',
    type: '/errors/validation/failed',
    retryable: false,
  },
  [ErrorCodes.INTERNAL_ERROR]: {
    status: 500,
    title: 'Internal server error',
    type: '/errors/internal',
    retryable: true,
  },
};
