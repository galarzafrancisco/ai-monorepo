import type { AgentTemplateCatalogResponseDto, CreateAgentDto } from '@taico/client/v2';

type AgentType = NonNullable<CreateAgentDto['type']>;

export function getSuggestedAvatarUrl(
  catalog: AgentTemplateCatalogResponseDto,
  value: Pick<CreateAgentDto, 'type' | 'providerId' | 'modelId'>,
): string | undefined {
  const provider = value.providerId?.trim().toLowerCase() ?? '';
  const model = value.modelId?.trim().toLowerCase() ?? '';

  if (provider.includes('anthropic') || model.includes('claude')) {
    return getAvatarUrlById(catalog, 'claude');
  }

  if (provider.includes('openai') || model.includes('gpt') || model.includes('codex')) {
    return getAvatarUrlById(catalog, 'openai');
  }

  if (provider.includes('google') || model.includes('gemini') || value.type === 'adk') {
    return getAvatarUrlById(catalog, 'gemini');
  }

  if (model.includes('qwen')) {
    return getAvatarUrlById(catalog, 'qwen');
  }

  return getAvatarUrlById(catalog, DEFAULT_AVATAR_ID_BY_TYPE[value.type ?? 'other']);
}

export function getAvatarLabel(
  catalog: AgentTemplateCatalogResponseDto,
  avatarUrl: string | null | undefined,
): string {
  return catalog.avatars.find((avatar) => avatar.url === avatarUrl)?.label ?? 'Default';
}

function getAvatarUrlById(
  catalog: AgentTemplateCatalogResponseDto,
  avatarId: string | undefined,
): string | undefined {
  return catalog.avatars.find((avatar) => avatar.id === avatarId)?.url;
}

const DEFAULT_AVATAR_ID_BY_TYPE: Record<AgentType, string | undefined> = {
  claude: 'claude',
  codex: 'openai',
  opencode: 'opencode',
  adk: 'gemini',
  githubcopilot: 'openai',
  other: undefined,
};
