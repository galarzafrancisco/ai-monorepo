import { Scope } from 'src/auth/core/types/scope.type';

export const ChatProvidersScopes = {
  READ: {
    id: 'chat_provider:read',
    description: 'Allows reading chat provider configurations.',
  },
  WRITE: {
    id: 'chat_provider:write',
    description: 'Allows creating and updating chat providers.',
  },
  DELETE: {
    id: 'chat_provider:delete',
    description: 'Allows deleting chat providers.',
  },
  CONFIGURE: {
    id: 'chat_provider:configure',
    description: 'Allows setting the active chat provider.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_CHAT_PROVIDERS_SCOPES: readonly Scope[] = Object.values(ChatProvidersScopes);
