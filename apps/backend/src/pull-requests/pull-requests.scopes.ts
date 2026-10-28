import { Scope } from 'src/auth/core/types/scope.type';

export const PullRequestsScopes = {
  READ: {
    id: 'pull_request:read',
    description: 'Allows reading the status Taico keeps of linked GitHub pull requests.',
  },
  WRITE: {
    id: 'pull_request:write',
    description: 'Allows asking Taico to read a pull request from GitHub again.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_PULL_REQUESTS_SCOPES: readonly Scope[] = Object.values(PullRequestsScopes);
