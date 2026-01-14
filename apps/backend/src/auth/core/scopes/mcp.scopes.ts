import { Scope } from "src/auth/core/types/scope.type";

export const McpScopes = {
  USE: {
    id: 'mcp:use',
    description: 'Allows users to interact with MCP endpoints.'
  },
} as const satisfies Record<string, Scope>;

export const ALL_MCP_SCOPES: readonly Scope[] =
  Object.values(McpScopes);