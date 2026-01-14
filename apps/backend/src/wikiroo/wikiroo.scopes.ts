import { Scope } from "src/auth/core/types/scope.type";

export const WikirooScopes ={
  READ: {
    id: 'wikiroo:read',
    description: 'Allows users to read pages, tags, comments, etc from Wikiroo.'
  },
  WRITE: {
    id: 'wikiroo:write',
    description: 'Allows users to create/update/delete pages, tags, comments from Wikiroo.'
  }
} as const satisfies Record<string, Scope>;

export const ALL_WIKIROO_SCOPES: readonly Scope[] =
  Object.values(WikirooScopes);