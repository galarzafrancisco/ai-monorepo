import { BaseClient, ClientConfig } from './base-client.js';
import type { AuthorizationServerMetadataDto, ProtectedResourceMetadataResponseDto } from './types.js';

export class DiscoveryResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Get the authorization server issuer URL */
  async DiscoveryController_getIssuer(params?: { signal?: AbortSignal }): Promise<{ issuer?: string }> {
    return this.request('GET', '/.well-known/oauth-authorization-server/mcp/issuer', { signal: params?.signal });
  }

  /** Expose OAuth 2.0 Authorization Server metadata for a registered MCP server version */
  async DiscoveryController_getAuthorizationServerMetadata(params: { mcpServerId: string; version: string; signal?: AbortSignal }): Promise<AuthorizationServerMetadataDto> {
    return this.request('GET', `/.well-known/oauth-authorization-server/mcp/${params.mcpServerId}/${params.version}`, { signal: params?.signal });
  }

  async DiscoveryController_all(params: { path: string[]; signal?: AbortSignal }): Promise<ProtectedResourceMetadataResponseDto> {
    return this.request('GET', `/.well-known/oauth-protected-resource/${params.path}`, { signal: params?.signal });
  }

}