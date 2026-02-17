import { Scope } from 'src/auth/core/types/scope.type';

export const SecretsScopes = {
  READ: {
    id: 'secret:read',
    description: 'Allows reading secret metadata (names, descriptions). Does not expose values.',
  },
  WRITE: {
    id: 'secret:write',
    description: 'Allows creating and updating secrets, including reading their decrypted values.',
  },
  DELETE: {
    id: 'secret:delete',
    description: 'Allows deleting secrets.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_SECRETS_SCOPES: readonly Scope[] = Object.values(SecretsScopes);
