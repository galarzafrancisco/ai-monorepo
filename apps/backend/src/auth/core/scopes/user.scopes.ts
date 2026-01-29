import { Scope } from 'src/auth/core/types/scope.type';

export const UserScopes = {
  ADMIN: {
    id: 'user:admin',
    description: 'User is an administrator.',
  },
  STANDARD: {
    id: 'user:standard',
    description: 'User is a standard user.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_USER_SCOPES: readonly Scope[] = Object.values(UserScopes);
