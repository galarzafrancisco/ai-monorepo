import { Scope } from 'src/auth/core/types/scope.type';

export const MetaScopes = {
  READ: {
    id: 'meta:read',
    description: 'Read meta information (tags, etc.)',
  },
  WRITE: {
    id: 'meta:write',
    description: 'Create, update, and delete meta information (tags, etc.)',
  },
} as const satisfies Record<string, Scope>;

export const ALL_META_SCOPES: readonly Scope[] = Object.values(MetaScopes);
