import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by MCP Registry
export const McpRegistryErrorCodes = {
  SERVER_NOT_FOUND: ErrorCodes.SERVER_NOT_FOUND,
  SERVER_ALREADY_EXISTS: ErrorCodes.SERVER_ALREADY_EXISTS,
  SCOPE_NOT_FOUND: ErrorCodes.SCOPE_NOT_FOUND,
  SCOPE_ALREADY_EXISTS: ErrorCodes.SCOPE_ALREADY_EXISTS,
  CONNECTION_NOT_FOUND: ErrorCodes.CONNECTION_NOT_FOUND,
  CONNECTION_NAME_CONFLICT: ErrorCodes.CONNECTION_NAME_CONFLICT,
  MAPPING_NOT_FOUND: ErrorCodes.MAPPING_NOT_FOUND,
  SERVER_HAS_DEPENDENCIES: ErrorCodes.SERVER_HAS_DEPENDENCIES,
  SCOPE_HAS_MAPPINGS: ErrorCodes.SCOPE_HAS_MAPPINGS,
  CONNECTION_HAS_MAPPINGS: ErrorCodes.CONNECTION_HAS_MAPPINGS,
  INVALID_MAPPING: ErrorCodes.INVALID_MAPPING,
} as const;

type McpRegistryErrorCode =
  typeof McpRegistryErrorCodes[keyof typeof McpRegistryErrorCodes];

/**
 * Base class for all MCP Registry domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class McpRegistryDomainError extends Error {
  constructor(
    message: string,
    readonly code: McpRegistryErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ServerNotFoundError extends McpRegistryDomainError {
  constructor(serverId: string) {
    super(
      `MCP server with ID '${serverId}' not found.`,
      McpRegistryErrorCodes.SERVER_NOT_FOUND,
      { serverId },
    );
  }
}

export class ServerAlreadyExistsError extends McpRegistryDomainError {
  constructor(providedId: string) {
    super(
      `MCP server with provided ID '${providedId}' already exists.`,
      McpRegistryErrorCodes.SERVER_ALREADY_EXISTS,
      { providedId },
    );
  }
}

export class ScopeNotFoundError extends McpRegistryDomainError {
  constructor(scopeId: string, serverId: string) {
    super(
      `MCP scope '${scopeId}' not found for server '${serverId}'.`,
      McpRegistryErrorCodes.SCOPE_NOT_FOUND,
      { scopeId, serverId },
    );
  }
}

export class ScopeAlreadyExistsError extends McpRegistryDomainError {
  constructor(scopeId: string, serverId: string) {
    super(
      `MCP scope '${scopeId}' already exists for server '${serverId}'.`,
      McpRegistryErrorCodes.SCOPE_ALREADY_EXISTS,
      { scopeId, serverId },
    );
  }
}

export class ConnectionNotFoundError extends McpRegistryDomainError {
  constructor(connectionId: string) {
    super(
      `MCP connection with ID '${connectionId}' not found.`,
      McpRegistryErrorCodes.CONNECTION_NOT_FOUND,
      { connectionId },
    );
  }
}

export class ConnectionNameConflictError extends McpRegistryDomainError {
  constructor(friendlyName: string, serverId: string) {
    super(
      `Connection with friendly name '${friendlyName}' already exists for server '${serverId}'.`,
      McpRegistryErrorCodes.CONNECTION_NAME_CONFLICT,
      { friendlyName, serverId },
    );
  }
}

export class MappingNotFoundError extends McpRegistryDomainError {
  constructor(mappingId: string) {
    super(
      `MCP scope mapping with ID '${mappingId}' not found.`,
      McpRegistryErrorCodes.MAPPING_NOT_FOUND,
      { mappingId },
    );
  }
}

export class ServerHasDependenciesError extends McpRegistryDomainError {
  constructor(serverId: string) {
    super(
      `Cannot delete server '${serverId}' because it still has scopes, connections, or mappings.`,
      McpRegistryErrorCodes.SERVER_HAS_DEPENDENCIES,
      { serverId },
    );
  }
}

export class ScopeHasMappingsError extends McpRegistryDomainError {
  constructor(scopeId: string) {
    super(
      `Cannot delete scope '${scopeId}' because it still has downstream mappings.`,
      McpRegistryErrorCodes.SCOPE_HAS_MAPPINGS,
      { scopeId },
    );
  }
}

export class ConnectionHasMappingsError extends McpRegistryDomainError {
  constructor(connectionId: string) {
    super(
      `Cannot delete connection '${connectionId}' because it still has scope mappings.`,
      McpRegistryErrorCodes.CONNECTION_HAS_MAPPINGS,
      { connectionId },
    );
  }
}

export class InvalidMappingError extends McpRegistryDomainError {
  constructor(message: string) {
    super(message, McpRegistryErrorCodes.INVALID_MAPPING);
  }
}
