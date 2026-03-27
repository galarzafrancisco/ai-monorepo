import { Scope } from 'src/auth/core/types/scope.type';

export const AgentsScopes = {
  READ: {
    id: 'agents:read',
    description: 'Allows users to view agents.',
  },
  WRITE: {
    id: 'agents:write',
    description: 'Allows users to create/update/delete agents.',
  },
  ACT_AS: {
    id: 'agents:act_as',
    description: 'Allows clients to request short-lived execution tokens for agents.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_AGENTS_SCOPES: readonly Scope[] = Object.values(AgentsScopes);
