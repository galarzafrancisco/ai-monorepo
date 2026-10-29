export const MCP_SERVER_TYPES = ['http', 'stdio'] as const;

export type McpServerType = (typeof MCP_SERVER_TYPES)[number];

export const MCP_SERVER_TYPE_HTTP = 'http' as const;
export const MCP_SERVER_TYPE_STDIO = 'stdio' as const;

/**
 * Who authorizes calls to an MCP server.
 * - `taico`: Taico is the server's OAuth authorization server. Workers send
 *   the agent's Taico execution token and execution ID to it.
 * - `external`: the server handles its own auth. Taico sends it no Taico
 *   credentials and does not serve OAuth metadata or token routes for it.
 */
export const MCP_SERVER_AUTH_TYPES = ['taico', 'external'] as const;

export type McpServerAuthType = (typeof MCP_SERVER_AUTH_TYPES)[number];

export const MCP_SERVER_AUTH_TYPE_TAICO = 'taico' as const;
export const MCP_SERVER_AUTH_TYPE_EXTERNAL = 'external' as const;
