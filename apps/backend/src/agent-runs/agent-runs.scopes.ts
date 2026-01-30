import { Scope } from 'src/auth/core/types/scope.type';

export const AgentRunsScopes = {
  READ: {
    id: 'run:read',
    description: 'Allows reading agent run information.',
  },
  WRITE: {
    id: 'run:write',
    description: 'Allows creating and updating agent runs.',
  },
  IMPERSONATE: {
    id: 'run:impersonate',
    description:
      'Allows retrieving JWT for agents through the runner (reserved for future use).',
  },
} as const satisfies Record<string, Scope>;

export const ALL_AGENT_RUNS_SCOPES: readonly Scope[] =
  Object.values(AgentRunsScopes);
