export const MetaScopes = {
  READ: {
    id: 'meta:read',
    description: 'Read meta information (tags, etc.)',
  },
  WRITE: {
    id: 'meta:write',
    description: 'Create, update, and delete meta information (tags, etc.)',
  },
} as const;
