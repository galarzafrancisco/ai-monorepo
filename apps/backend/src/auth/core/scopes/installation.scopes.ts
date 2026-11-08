import { Scope } from 'src/auth/core/types/scope.type';

/**
 * Scopes of whoever runs the installation, across every workspace. A web
 * session gets `installation:admin` only when the person's `users.role` is
 * `admin`. See "Admin roles" in docs/architecture/workspaces.md.
 */
export const InstallationScopes = {
  ADMIN: {
    id: 'installation:admin',
    description:
      'Installation operator: creates workspaces, manages logins and access requests, and configures search.',
  },
} as const satisfies Record<string, Scope>;
