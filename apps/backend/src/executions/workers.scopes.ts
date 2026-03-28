import { Scope } from 'src/auth/core/types/scope.type';

export const WorkersScopes = {
  CONNECT: {
    id: 'workers:connect',
    description: 'Allows workers to connect to the workers gateway.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_WORKERS_SCOPES: readonly Scope[] =
  Object.values(WorkersScopes);
