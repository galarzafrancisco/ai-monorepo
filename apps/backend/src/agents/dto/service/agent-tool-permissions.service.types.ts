import type { McpServerType } from '../../../mcp-registry/mcp-server.types';

export type AgentToolPermissionScopeRecord = {
  id: string;
  description: string;
};

export type AgentToolPermissionRecord = {
  serverId: string;
  serverProvidedId: string;
  serverName: string;
  serverDescription: string;
  serverType: McpServerType;
  grantedScopes: AgentToolPermissionScopeRecord[];
  hasAllScopes: boolean;
};

export type UpsertAgentToolPermissionInput = {
  scopeIds: string[];
};
