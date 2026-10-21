import { Scope } from 'src/auth/core/types/scope.type';

export const AiProvidersScopes = {
  READ: {
    id: 'ai_provider:read',
    description: 'Allows reading AI provider configurations.',
  },
  WRITE: {
    id: 'ai_provider:write',
    description: 'Allows creating and updating AI providers.',
  },
  DELETE: {
    id: 'ai_provider:delete',
    description: 'Allows deleting AI providers.',
  },
  CONNECT: {
    id: 'ai_provider:connect',
    description: 'Allows connecting and disconnecting your own account at an AI provider.',
  },
  CONFIGURE: {
    id: 'ai_provider:configure',
    description: 'Allows choosing which model each job uses.',
  },
} as const satisfies Record<string, Scope>;

export const ALL_AI_PROVIDERS_SCOPES: readonly Scope[] = Object.values(AiProvidersScopes);
