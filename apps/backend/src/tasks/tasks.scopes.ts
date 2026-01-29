import { Scope } from 'src/auth/core/types/scope.type';

export const TasksScopes = {
  READ: {
    id: 'tasks:read',
    description: 'Allows users to read tasks, tags, comments, etc from Tasks.',
  },
  WRITE: {
    id: 'tasks:write',
    description:
      'Allows users to create/update/delete tasks, tags, comments from Tasks.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_TASKS_SCOPES: readonly Scope[] = Object.values(TasksScopes);
