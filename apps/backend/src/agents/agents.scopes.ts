import { Scope } from "src/auth/core/types/scope.type";

export const AgentsScopes = {
  READ: {
    id: 'agents:read',
    description: 'Allows users to view agents.'
  },
  WRITE: {
    id: 'agents:write',
    description: 'Allows users to create/update/delete agents.'
  }
} as const satisfies Record<string, Scope>;

export const ALL_AGENTS_SCOPES: readonly Scope[] =
  Object.values(AgentsScopes);