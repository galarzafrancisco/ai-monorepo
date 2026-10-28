import { Scope } from 'src/auth/core/types/scope.type';

export const IntegrationsScopes = {
  READ: {
    id: 'integration:read',
    description: 'Allows reading integration connections (never their credentials).',
  },
  WRITE: {
    id: 'integration:write',
    description: 'Allows creating and updating integration connections and their credentials.',
  },
  DELETE: {
    id: 'integration:delete',
    description: 'Allows deleting integration connections.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_INTEGRATIONS_SCOPES: readonly Scope[] = Object.values(IntegrationsScopes);
