import { Scope } from 'src/auth/core/types/scope.type';

export const SearchScopes = {
  CONFIGURE: {
    id: 'search:configure',
    description: 'Allows changing search settings and rebuilding the search index.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_SEARCH_SCOPES: readonly Scope[] = Object.values(SearchScopes);
