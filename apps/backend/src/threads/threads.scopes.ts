import { Scope } from 'src/auth/core/types/scope.type';

export const ThreadsScopes = {
  READ: {
    id: 'threads:read',
    description: 'Allows users to read threads and related data.',
  },
  WRITE: {
    id: 'threads:write',
    description: 'Allows users to create/update/delete threads.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_THREADS_SCOPES: readonly Scope[] = Object.values(ThreadsScopes);
