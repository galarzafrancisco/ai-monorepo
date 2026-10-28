import { Scope } from 'src/auth/core/types/scope.type';

export const IssuesScopes = {
  READ: {
    id: 'issue:read',
    description: 'Allows reading the status Taico keeps of linked GitHub issues.',
  },
  WRITE: {
    id: 'issue:write',
    description: 'Allows asking Taico to read an issue from GitHub again.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_ISSUES_SCOPES: readonly Scope[] = Object.values(IssuesScopes);
