import { SetMetadata } from '@nestjs/common';

export const MCP_RESOURCE_KEY = 'auth:mcp_resource';

/**
 * Marks a route as the endpoint of an MCP server (an OAuth protected resource).
 * AccessTokenGuard rejects tokens whose audience is another MCP server.
 *
 * Takes a resolver because the resource URL depends on runtime configuration.
 */
export const McpResource = (resolveResourceUrl: () => string) =>
  SetMetadata(MCP_RESOURCE_KEY, resolveResourceUrl);
