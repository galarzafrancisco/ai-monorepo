import { Scope } from "src/auth/core/types/scope.type";

export const McpRegistryScopes = {
  READ: {
    id: 'mcp-registry:read',
    description: 'Allows users to view MCP servers in the registry.',
  },
  WRITE: {
    id: 'mcp-registry:write',
    description: 'Allows users to create/update/delete MCP servers in the registry.',
  }
} as const satisfies Record<string, Scope>;

export const ALL_MCP_REGISTRY_SCOPES: readonly Scope[] =
  Object.values(McpRegistryScopes);