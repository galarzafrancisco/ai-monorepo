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

const BASELINE_SCOPES_BY_PROVIDED_ID: Record<string, readonly string[]> = {
  tasks: ['tasks:read', 'tasks:write'],
  context: ['context:read', 'context:write'],
};

export type AgentRuntimeScopeLike = {
  id: string;
};

export type AgentRuntimeToolPermissionLike = {
  server: {
    providedId: string;
  };
  availableScopes: AgentRuntimeScopeLike[];
  grantedScopes: AgentRuntimeScopeLike[];
};

export function isBaselineSystemTool(providedId: string): boolean {
  return BASELINE_SYSTEM_TOOL_PROVIDED_IDS.includes(
    providedId as (typeof BASELINE_SYSTEM_TOOL_PROVIDED_IDS)[number],
  );
}

export function deriveExecutionScopesFromToolPermissions(
  permissions: AgentRuntimeToolPermissionLike[],
): string[] {
  const scopes = new Set<string>(BASELINE_AGENT_EXECUTION_SCOPES);

  for (const permission of permissions) {
    const providedId = permission.server.providedId;
    if (isBaselineSystemTool(providedId)) {
      const availableScopeIds = permission.availableScopes.map((scope) => scope.id);
      const fallbackScopes = BASELINE_SCOPES_BY_PROVIDED_ID[providedId] ?? [];
      const baselineScopes = availableScopeIds.length > 0 ? availableScopeIds : fallbackScopes;

      for (const scopeId of baselineScopes) {
        scopes.add(scopeId);
      }
      continue;
    }

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
