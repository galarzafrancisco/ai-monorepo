import { BaseClient, ClientConfig } from './base-client.js';
import type { ConnectionResponseDto, CreateConnectionDto, CreateMappingDto, CreateScopeDto, CreateServerDto, DeleteConnectionResponseDto, DeleteMappingResponseDto, DeleteScopeResponseDto, DeleteServerResponseDto, MappingResponseDto, ScopeResponseDto, ServerListResponseDto, ServerResponseDto, UpdateConnectionDto, UpdateServerDto } from './types.js';

export class ToolsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Register a new MCP server */
  async McpRegistryController_createServer(params: { body: CreateServerDto; signal?: AbortSignal }): Promise<ServerResponseDto> {
    return this.request('POST', '/api/v1/mcp/servers', { body: params.body, signal: params?.signal });
  }

  /** List all MCP servers with pagination */
  async McpRegistryController_listServers(params?: { page?: number; limit?: number; signal?: AbortSignal }): Promise<ServerListResponseDto> {
    return this.request('GET', '/api/v1/mcp/servers', { params: { page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

  /** Get MCP server by UUID or provided ID */
  async McpRegistryController_getServer(params: { serverId: string; signal?: AbortSignal }): Promise<ServerResponseDto> {
    return this.request('GET', `/api/v1/mcp/servers/${params.serverId}`, { signal: params?.signal });
  }

  /** Update MCP server details */
  async McpRegistryController_updateServer(params: { serverId: string; body: UpdateServerDto; signal?: AbortSignal }): Promise<ServerResponseDto> {
    return this.request('PATCH', `/api/v1/mcp/servers/${params.serverId}`, { body: params.body, signal: params?.signal });
  }

  /** Delete MCP server (must have no dependencies) */
  async McpRegistryController_deleteServer(params: { serverId: string; signal?: AbortSignal }): Promise<DeleteServerResponseDto> {
    return this.request('DELETE', `/api/v1/mcp/servers/${params.serverId}`, { signal: params?.signal });
  }

  /** Create MCP scope(s) for a server */
  async McpRegistryController_createScopes(params: { serverId: string; body: CreateScopeDto[]; signal?: AbortSignal }): Promise<ScopeResponseDto[]> {
    return this.request('POST', `/api/v1/mcp/servers/${params.serverId}/scopes`, { body: params.body, signal: params?.signal });
  }

  /** List all scopes for an MCP server */
  async McpRegistryController_listScopes(params: { serverId: string; signal?: AbortSignal }): Promise<ScopeResponseDto[]> {
    return this.request('GET', `/api/v1/mcp/servers/${params.serverId}/scopes`, { signal: params?.signal });
  }

  /** Get a specific MCP scope */
  async McpRegistryController_getScope(params: { serverId: string; scopeId: string; signal?: AbortSignal }): Promise<ScopeResponseDto> {
    return this.request('GET', `/api/v1/mcp/servers/${params.serverId}/scopes/${params.scopeId}`, { signal: params?.signal });
  }

  /** Delete MCP scope (must have no mappings) */
  async McpRegistryController_deleteScope(params: { serverId: string; scopeId: string; signal?: AbortSignal }): Promise<DeleteScopeResponseDto> {
    return this.request('DELETE', `/api/v1/mcp/servers/${params.serverId}/scopes/${params.scopeId}`, { signal: params?.signal });
  }

  /** Create OAuth connection for an MCP server */
  async McpRegistryController_createConnection(params: { serverId: string; body: CreateConnectionDto; signal?: AbortSignal }): Promise<ConnectionResponseDto> {
    return this.request('POST', `/api/v1/mcp/servers/${params.serverId}/connections`, { body: params.body, signal: params?.signal });
  }

  /** List all connections for an MCP server */
  async McpRegistryController_listConnections(params: { serverId: string; signal?: AbortSignal }): Promise<ConnectionResponseDto[]> {
    return this.request('GET', `/api/v1/mcp/servers/${params.serverId}/connections`, { signal: params?.signal });
  }

  /** Get a specific connection */
  async McpRegistryController_getConnection(params: { connectionId: string; signal?: AbortSignal }): Promise<ConnectionResponseDto> {
    return this.request('GET', `/api/v1/mcp/connections/${params.connectionId}`, { signal: params?.signal });
  }

  /** Update connection details */
  async McpRegistryController_updateConnection(params: { connectionId: string; body: UpdateConnectionDto; signal?: AbortSignal }): Promise<ConnectionResponseDto> {
    return this.request('PATCH', `/api/v1/mcp/connections/${params.connectionId}`, { body: params.body, signal: params?.signal });
  }

  /** Delete connection (must have no mappings) */
  async McpRegistryController_deleteConnection(params: { connectionId: string; signal?: AbortSignal }): Promise<DeleteConnectionResponseDto> {
    return this.request('DELETE', `/api/v1/mcp/connections/${params.connectionId}`, { signal: params?.signal });
  }

  /** Create scope mapping */
  async McpRegistryController_createMapping(params: { serverId: string; body: CreateMappingDto; signal?: AbortSignal }): Promise<MappingResponseDto> {
    return this.request('POST', `/api/v1/mcp/servers/${params.serverId}/mappings`, { body: params.body, signal: params?.signal });
  }

  /** List downstream scopes for an MCP scope */
  async McpRegistryController_listMappings(params: { serverId: string; scopeId: string; signal?: AbortSignal }): Promise<MappingResponseDto[]> {
    return this.request('GET', `/api/v1/mcp/servers/${params.serverId}/scopes/${params.scopeId}/mappings`, { signal: params?.signal });
  }

  /** Delete scope mapping */
  async McpRegistryController_deleteMapping(params: { mappingId: string; signal?: AbortSignal }): Promise<DeleteMappingResponseDto> {
    return this.request('DELETE', `/api/v1/mcp/mappings/${params.mappingId}`, { signal: params?.signal });
  }

}