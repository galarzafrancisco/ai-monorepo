export { createAuthorizationServer, requireScopes } from './authorization-server.js';
export { memoryKeyStore } from './key-store.js';
export { memoryStorage } from './storage/memory.js';
export { sqliteKeyStore, sqliteStorage } from './storage/sqlite.js';
export type { SqliteAuthorizationStorage, SqliteAuthorizationStorageOptions } from './storage/sqlite.js';
export {
  DownstreamTokenUnavailableError,
  InsufficientScopeError,
  InvalidTokenError,
  RequireScopesError,
  UnknownDownstreamConnectionError,
} from './errors.js';
export type {
  AccessTokenClaims,
  AuthorizationGrant,
  AuthContext,
  AuthorizationInteraction,
  AuthorizationServerMetadata,
  AuthorizationServerOptions,
  AuthorizationStorage,
  ClientDefinition,
  DownstreamConnectionDefinition,
  DownstreamToken,
  DownstreamTokenExchangeInput,
  ExpressMiddleware,
  ExpressNextFunction,
  ExpressRequestLike,
  ExpressResponseLike,
  ExternalOAuthProvider,
  IdentityProvider,
  IssueTokenInput,
  IssuedToken,
  KeyStore,
  McpRequestContext,
  McpServerDefinition,
  McpServerHandle,
  MetadataInput,
  Principal,
  ProtectedResourceMetadata,
  ScopeDefinition,
  ValidateTokenOptions,
} from './types.js';
