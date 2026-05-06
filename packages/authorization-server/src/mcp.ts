import type { AuthContext, McpServerDefinition, Principal, ScopeDefinition } from './types.js';

export type McpRequestContext = {
  principal?: Principal;
  auth: AuthContext;
  requireScopes(scopes: string | string[]): void;
};

export type McpServerHandle = {
  id: string;
  name: string;
  version: string;
  resource: string;
  scopes: ScopeDefinition[];
  requiredScopes: string[];
  definition: McpServerDefinition;
};

export function createMcpServerHandle(definition: McpServerDefinition, scopes: ScopeDefinition[]): McpServerHandle {
  return {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    resource: definition.resource,
    scopes,
    requiredScopes: definition.requiredScopes ?? [],
    definition,
  };
}
