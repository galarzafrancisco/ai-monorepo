/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthJourneyResponseDto } from '../models/AuthJourneyResponseDto';
import type { ConnectionResponseDto } from '../models/ConnectionResponseDto';
import type { CreateConnectionDto } from '../models/CreateConnectionDto';
import type { CreateMappingDto } from '../models/CreateMappingDto';
import type { CreateScopeDto } from '../models/CreateScopeDto';
import type { CreateServerDto } from '../models/CreateServerDto';
import type { DeleteConnectionResponseDto } from '../models/DeleteConnectionResponseDto';
import type { DeleteMappingResponseDto } from '../models/DeleteMappingResponseDto';
import type { DeleteScopeResponseDto } from '../models/DeleteScopeResponseDto';
import type { DeleteServerResponseDto } from '../models/DeleteServerResponseDto';
import type { MappingResponseDto } from '../models/MappingResponseDto';
import type { ScopeResponseDto } from '../models/ScopeResponseDto';
import type { ServerListResponseDto } from '../models/ServerListResponseDto';
import type { ServerResponseDto } from '../models/ServerResponseDto';
import type { UpdateConnectionDto } from '../models/UpdateConnectionDto';
import type { UpdateServerDto } from '../models/UpdateServerDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class McpRegistryService {
    /**
     * Register a new MCP server
     * @param requestBody
     * @returns ServerResponseDto Server created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateServer(
        requestBody: CreateServerDto,
    ): CancelablePromise<ServerResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/servers',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `Server with providedId already exists`,
            },
        });
    }
    /**
     * List all MCP servers with pagination
     * @param page
     * @param limit
     * @returns ServerListResponseDto List of servers
     * @throws ApiError
     */
    public static mcpRegistryControllerListServers(
        page?: number,
        limit?: number,
    ): CancelablePromise<ServerListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers',
            query: {
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Get MCP server by UUID or provided ID
     * @param serverId Server UUID or provided ID
     * @returns ServerResponseDto Server found
     * @throws ApiError
     */
    public static mcpRegistryControllerGetServer(
        serverId: string,
    ): CancelablePromise<ServerResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers/{serverId}',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
            },
        });
    }
    /**
     * Update MCP server details
     * @param serverId Server UUID
     * @param requestBody
     * @returns ServerResponseDto Server updated successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerUpdateServer(
        serverId: string,
        requestBody: UpdateServerDto,
    ): CancelablePromise<ServerResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/mcp/servers/{serverId}',
            path: {
                'serverId': serverId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Server not found`,
            },
        });
    }
    /**
     * Delete MCP server (must have no dependencies)
     * @param serverId Server UUID
     * @returns DeleteServerResponseDto Server deleted successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteServer(
        serverId: string,
    ): CancelablePromise<DeleteServerResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/mcp/servers/{serverId}',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
                409: `Server has dependencies`,
            },
        });
    }
    /**
     * Create MCP scope(s) for a server
     * @param serverId Server UUID
     * @param requestBody Array of scopes to create
     * @returns ScopeResponseDto Scope(s) created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateScopes(
        serverId: string,
        requestBody: Array<CreateScopeDto>,
    ): CancelablePromise<Array<ScopeResponseDto>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/servers/{serverId}/scopes',
            path: {
                'serverId': serverId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Server not found`,
                409: `Scope already exists`,
            },
        });
    }
    /**
     * List all scopes for an MCP server
     * @param serverId Server UUID
     * @returns ScopeResponseDto List of scopes
     * @throws ApiError
     */
    public static mcpRegistryControllerListScopes(
        serverId: string,
    ): CancelablePromise<Array<ScopeResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers/{serverId}/scopes',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
            },
        });
    }
    /**
     * Get a specific MCP scope
     * @param serverId Server UUID
     * @param scopeId Scope ID string
     * @returns ScopeResponseDto Scope found
     * @throws ApiError
     */
    public static mcpRegistryControllerGetScope(
        serverId: string,
        scopeId: string,
    ): CancelablePromise<ScopeResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers/{serverId}/scopes/{scopeId}',
            path: {
                'serverId': serverId,
                'scopeId': scopeId,
            },
            errors: {
                404: `Scope not found`,
            },
        });
    }
    /**
     * Delete MCP scope (must have no mappings)
     * @param serverId Server UUID
     * @param scopeId Scope ID string
     * @returns DeleteScopeResponseDto Scope deleted successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteScope(
        serverId: string,
        scopeId: string,
    ): CancelablePromise<DeleteScopeResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/mcp/servers/{serverId}/scopes/{scopeId}',
            path: {
                'serverId': serverId,
                'scopeId': scopeId,
            },
            errors: {
                404: `Scope not found`,
                409: `Scope has mappings`,
            },
        });
    }
    /**
     * Create OAuth connection for an MCP server
     * @param serverId Server UUID
     * @param requestBody
     * @returns ConnectionResponseDto Connection created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateConnection(
        serverId: string,
        requestBody: CreateConnectionDto,
    ): CancelablePromise<ConnectionResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/servers/{serverId}/connections',
            path: {
                'serverId': serverId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Server not found`,
                409: `Connection name conflict`,
            },
        });
    }
    /**
     * List all connections for an MCP server
     * @param serverId Server UUID
     * @returns ConnectionResponseDto List of connections
     * @throws ApiError
     */
    public static mcpRegistryControllerListConnections(
        serverId: string,
    ): CancelablePromise<Array<ConnectionResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers/{serverId}/connections',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
            },
        });
    }
    /**
     * Get a specific connection
     * @param connectionId Connection UUID
     * @returns ConnectionResponseDto Connection found
     * @throws ApiError
     */
    public static mcpRegistryControllerGetConnection(
        connectionId: string,
    ): CancelablePromise<ConnectionResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/connections/{connectionId}',
            path: {
                'connectionId': connectionId,
            },
            errors: {
                404: `Connection not found`,
            },
        });
    }
    /**
     * Update connection details
     * @param connectionId Connection UUID
     * @param requestBody
     * @returns ConnectionResponseDto Connection updated successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerUpdateConnection(
        connectionId: string,
        requestBody: UpdateConnectionDto,
    ): CancelablePromise<ConnectionResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/mcp/connections/{connectionId}',
            path: {
                'connectionId': connectionId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Connection not found`,
                409: `Connection name conflict`,
            },
        });
    }
    /**
     * Delete connection (must have no mappings)
     * @param connectionId Connection UUID
     * @returns DeleteConnectionResponseDto Connection deleted successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteConnection(
        connectionId: string,
    ): CancelablePromise<DeleteConnectionResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/mcp/connections/{connectionId}',
            path: {
                'connectionId': connectionId,
            },
            errors: {
                404: `Connection not found`,
                409: `Connection has mappings`,
            },
        });
    }
    /**
     * Create scope mapping
     * @param serverId Server UUID
     * @param requestBody
     * @returns MappingResponseDto Mapping created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateMapping(
        serverId: string,
        requestBody: CreateMappingDto,
    ): CancelablePromise<MappingResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/servers/{serverId}/mappings',
            path: {
                'serverId': serverId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid mapping`,
                404: `Scope or connection not found`,
            },
        });
    }
    /**
     * List downstream scopes for an MCP scope
     * @param serverId Server UUID
     * @param scopeId Scope ID string
     * @returns MappingResponseDto List of mappings
     * @throws ApiError
     */
    public static mcpRegistryControllerListMappings(
        serverId: string,
        scopeId: string,
    ): CancelablePromise<Array<MappingResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers/{serverId}/scopes/{scopeId}/mappings',
            path: {
                'serverId': serverId,
                'scopeId': scopeId,
            },
            errors: {
                404: `Scope not found`,
            },
        });
    }
    /**
     * Delete scope mapping
     * @param mappingId Mapping UUID
     * @returns DeleteMappingResponseDto Mapping deleted successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteMapping(
        mappingId: string,
    ): CancelablePromise<DeleteMappingResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/mcp/mappings/{mappingId}',
            path: {
                'mappingId': mappingId,
            },
            errors: {
                404: `Mapping not found`,
            },
        });
    }
    /**
     * Get authorization journeys for an MCP server (debug/monitoring)
     * @param serverId Server UUID
     * @returns AuthJourneyResponseDto List of authorization journeys
     * @throws ApiError
     */
    public static mcpRegistryControllerGetAuthJourneys(
        serverId: string,
    ): CancelablePromise<Array<AuthJourneyResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/mcp/servers/{serverId}/auth-journeys',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
            },
        });
    }
}
