import { Scope } from 'src/auth/core/types/scope.type';

export const WorkersScopes = {
  CONNECT: {
    id: 'workers:connect',
    description:
      'Allows worker clients to connect to the Workers WebSocket gateway.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_WORKERS_SCOPES: readonly Scope[] = Object.values(WorkersScopes);
