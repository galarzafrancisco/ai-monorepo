import { Scope } from "src/auth/core/types/scope.type";

export const TaskerooScopes = {
  READ: {
    id: 'taskeroo:read',
    description: 'Allows users to read tasks, tags, comments, etc from Taskeroo.'
  },
  WRITE: {
    id: 'taskeroo:write',
    description: 'Allows users to create/update/delete tasks, tags, comments from Taskeroo.'
  }
} as const satisfies Record<string, Scope>;

export const ALL_TASKEROO_SCOPES: readonly Scope[] =
  Object.values(TaskerooScopes);