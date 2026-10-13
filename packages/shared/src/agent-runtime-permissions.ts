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

export const PER_TOOL_EXECUTION_TOKEN_KIND = 'tool';

export type PerToolExecutionTokenKind = typeof PER_TOOL_EXECUTION_TOKEN_KIND;

export type PerToolExecutionTokenClaims = {
  token_kind: PerToolExecutionTokenKind;
  tool_id: string;
  tool_scopes: string[];
};

export type PerToolExecutionScopeMap = Record<string, string[]>;

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

export function derivePerToolExecutionScopesFromToolPermissions(
  permissions: AgentRuntimeToolPermissionLike[],
): PerToolExecutionScopeMap {
  const perToolScopes = new Map<string, Set<string>>();

  for (const permission of permissions) {
    const providedId = permission.server.providedId;
    if (!providedId) {
      continue;
    }

    const scopeSet =
      perToolScopes.get(providedId) ??
      new Set<string>(BASELINE_AGENT_EXECUTION_SCOPES);

    for (const scope of permission.grantedScopes) {
      scopeSet.add(scope.id);
    }

    perToolScopes.set(providedId, scopeSet);
  }

  const result: PerToolExecutionScopeMap = {};
  for (const [providedId, scopes] of [...perToolScopes.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    result[providedId] = [...scopes].sort((a, b) => a.localeCompare(b));
  }

  return result;
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
