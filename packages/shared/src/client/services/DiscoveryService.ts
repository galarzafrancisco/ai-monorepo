/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthorizationServerMetadataDto } from '../models/AuthorizationServerMetadataDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DiscoveryService {
    /**
     * Get the authorization server issuer URL
     * Returns the configured authorization server issuer URL from environment configuration
     * @returns any Issuer URL retrieved successfully
     * @throws ApiError
     */
    public static discoveryControllerGetIssuer(): CancelablePromise<{
        issuer?: string;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/.well-known/oauth-authorization-server/mcp/issuer',
        });
    }
    /**
     * Expose OAuth 2.0 Authorization Server metadata for a registered MCP server version
     * Provides discovery metadata (RFC 8414) for OAuth 2.0 clients integrating with a specific MCP server version. Accepts either the server UUID or the providedId.
     * @param mcpServerId MCP server UUID or providedId
     * @param version Semantic version of the MCP server
     * @returns AuthorizationServerMetadataDto Authorization server metadata retrieved successfully
     * @throws ApiError
     */
    public static discoveryControllerGetAuthorizationServerMetadata(
        mcpServerId: string,
        version: string,
    ): CancelablePromise<AuthorizationServerMetadataDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/.well-known/oauth-authorization-server/mcp/{mcpServerId}/{version}',
            path: {
                'mcpServerId': mcpServerId,
                'version': version,
            },
        });
    }
}
