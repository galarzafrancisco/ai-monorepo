/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateConnectionDto } from '../models/CreateConnectionDto';
import type { CreateMappingDto } from '../models/CreateMappingDto';
import type { CreateServerDto } from '../models/CreateServerDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class McpRegistryService {
    /**
     * Register a new MCP server
     * @param requestBody
     * @returns any Server created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateServer(
        requestBody: CreateServerDto,
    ): CancelablePromise<any> {
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
     * @returns any List of servers
     * @throws ApiError
     */
    public static mcpRegistryControllerListServers(
        page?: number,
        limit?: number,
    ): CancelablePromise<any> {
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
     * @returns any Server found
     * @throws ApiError
     */
    public static mcpRegistryControllerGetServer(
        serverId: string,
    ): CancelablePromise<any> {
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
     * Delete MCP server (must have no dependencies)
     * @param serverId Server UUID
     * @returns void
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteServer(
        serverId: string,
    ): CancelablePromise<void> {
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
     * @returns any Scope(s) created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateScopes(
        serverId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/servers/{serverId}/scopes',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
                409: `Scope already exists`,
            },
        });
    }
    /**
     * List all scopes for an MCP server
     * @param serverId Server UUID
     * @returns any List of scopes
     * @throws ApiError
     */
    public static mcpRegistryControllerListScopes(
        serverId: string,
    ): CancelablePromise<any> {
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
     * @returns any Scope found
     * @throws ApiError
     */
    public static mcpRegistryControllerGetScope(
        serverId: string,
        scopeId: string,
    ): CancelablePromise<any> {
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
     * @returns void
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteScope(
        serverId: string,
        scopeId: string,
    ): CancelablePromise<void> {
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
     * @returns any Connection created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateConnection(
        serverId: string,
        requestBody: CreateConnectionDto,
    ): CancelablePromise<any> {
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
     * @returns any List of connections
     * @throws ApiError
     */
    public static mcpRegistryControllerListConnections(
        serverId: string,
    ): CancelablePromise<any> {
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
     * @returns any Connection found
     * @throws ApiError
     */
    public static mcpRegistryControllerGetConnection(
        connectionId: string,
    ): CancelablePromise<any> {
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
     * Delete connection (must have no mappings)
     * @param connectionId Connection UUID
     * @returns void
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteConnection(
        connectionId: string,
    ): CancelablePromise<void> {
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
     * @returns any Mapping created successfully
     * @throws ApiError
     */
    public static mcpRegistryControllerCreateMapping(
        serverId: string,
        requestBody: CreateMappingDto,
    ): CancelablePromise<any> {
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
     * @returns any List of mappings
     * @throws ApiError
     */
    public static mcpRegistryControllerListMappings(
        serverId: string,
        scopeId: string,
    ): CancelablePromise<any> {
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
     * @returns void
     * @throws ApiError
     */
    public static mcpRegistryControllerDeleteMapping(
        mappingId: string,
    ): CancelablePromise<void> {
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
}
