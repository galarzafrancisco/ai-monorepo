export const BASELINE_SYSTEM_TOOL_PROVIDED_IDS = ['tasks', 'context'] as const;

export const BASELINE_AGENT_EXECUTION_SCOPES = [
  'meta:read',
  'mcp:use',
  'tasks:read',
  'tasks:write',
  'context:read',
  'context:write',
] as const;

export const DEFAULT_AGENT_ALLOWED_TOOLS = [
  'SlashCommand',
  'Bash',
  'Read',
  'Write',
  'Edit',
] as const;

export type AgentRuntimeScopeLike = {
  id: string;
};

export type AgentRuntimeToolPermissionLike = {
  server: {
    providedId: string;
  };
  grantedScopes: AgentRuntimeScopeLike[];
};

export function deriveExecutionScopesFromToolPermissions(
  permissions: AgentRuntimeToolPermissionLike[],
): string[] {
  const scopes = new Set<string>(BASELINE_AGENT_EXECUTION_SCOPES);

  for (const permission of permissions) {
    for (const scope of permission.grantedScopes) {
      scopes.add(scope.id);
    }
  }

  return [...scopes].sort((a, b) => a.localeCompare(b));
}

export function deriveAllowedToolsFromProvidedIds(
  providedIds: string[],
  alwaysAllowedTools: readonly string[] = DEFAULT_AGENT_ALLOWED_TOOLS,
): string[] {
  const tools = new Set<string>(alwaysAllowedTools);
  for (const providedId of providedIds) {
    tools.add(`mcp__${providedId}__*`);
  }
  return [...tools];
}
