import { Scope } from 'src/auth/core/types/scope.type';

export const ContextScopes = {
  READ: {
    id: 'context:read',
    description: 'Allows users to read context blocks',
  },
  WRITE: {
    id: 'context:write',
    description: 'Allows users to create/update/delete context blocks',
  },
} as const satisfies Record<string, Scope>;

export const ALL_CONTEXT_SCOPES: readonly Scope[] =
  Object.values(ContextScopes);
