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

export type ResolvedAgentToolGrant = {
  serverId: string;
  scopeIds: string[];
};

export type ResolvedAgentToolGrants = {
  grants: ResolvedAgentToolGrant[];
  /** Provided ids of servers that aren't in this workspace. */
  missingServers: string[];
  /** Scopes the named server doesn't offer. */
  invalidScopes: { serverProvidedId: string; scopeIds: string[] }[];
};
