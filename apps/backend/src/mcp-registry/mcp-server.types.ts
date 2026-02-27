export const MCP_SERVER_TYPES = ['http', 'stdio'] as const;

export type McpServerType = (typeof MCP_SERVER_TYPES)[number];

export const MCP_SERVER_TYPE_HTTP = 'http' as const;
export const MCP_SERVER_TYPE_STDIO = 'stdio' as const;
