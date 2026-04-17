import { AgentType } from './enums';

export type AgentAvatarDefinition = {
  id: string;
  label: string;
  url: string;
  description: string;
};

export const AGENT_AVATARS: AgentAvatarDefinition[] = [
  {
    id: 'taico',
    label: 'Taico',
    url: '/avatar/taico.png',
    description: 'Taico app avatar for the system operator agent.',
  },
  {
    id: 'angus',
    label: 'Angus',
    url: '/avatar/angus.png',
    description: 'Bundled Angus avatar for agent profiles.',
  },
  {
    id: 'bruce',
    label: 'Bruce',
    url: '/avatar/bruce.png',
    description: 'Bundled Bruce avatar for agent profiles.',
  },
  {
    id: 'grace',
    label: 'Grace',
    url: '/avatar/grace.png',
    description: 'Bundled Grace avatar for agent profiles.',
  },
  {
    id: 'gustav',
    label: 'Gustav',
    url: '/avatar/gustav.png',
    description: 'Bundled Gustav avatar for agent profiles.',
  },
  {
    id: 'stacy',
    label: 'Stacy',
    url: '/avatar/stacy.png',
    description: 'Bundled Stacy avatar for agent profiles.',
  },
  {
    id: 'claude',
    label: 'Claude',
    url: '/avatar/claude.webp',
    description: 'Anthropic-inspired avatar for Claude based agents.',
  },
  {
    id: 'openai',
    label: 'OpenAI Blossom',
    url: '/avatar/openai.svg',
    description: 'OpenAI-inspired avatar for GPT and Codex model selections.',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    url: '/avatar/opencode.svg',
    description: 'OpenCode logo for runtime-oriented agent setups.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    url: '/avatar/gemini.png',
    description: 'Gemini and ADK-flavored avatar.',
  },
  {
    id: 'cockatoo',
    label: 'Cockatoo',
    url: '/avatar/cockatoo.png',
    description: 'Friendly reviewer-style mascot avatar.',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    url: '/avatar/qwen.png',
    description: 'Qwen model avatar for custom model configurations.',
  },
];

const AVATAR_BY_ID = new Map(AGENT_AVATARS.map((avatar) => [avatar.id, avatar]));
const AVATAR_URLS = new Set(AGENT_AVATARS.map((avatar) => avatar.url));

const DEFAULT_AVATAR_BY_TYPE: Record<AgentType, string | null> = {
  [AgentType.CLAUDE]: 'claude',
  [AgentType.CODEX]: 'openai',
  [AgentType.OPENCODE]: 'opencode',
  [AgentType.ADK]: 'gemini',
  [AgentType.GITHUBCOPILOT]: 'openai',
  [AgentType.OTHER]: null,
};

export function getAgentAvatarUrlById(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  return AVATAR_BY_ID.get(id)?.url ?? null;
}

export function isManagedAgentAvatarUrl(
  url: string | null | undefined,
): boolean {
  if (url == null) {
    return true;
  }

  return AVATAR_URLS.has(url);
}

export function getDefaultAgentAvatarUrl({
  type,
  providerId,
  modelId,
}: {
  type?: AgentType;
  providerId?: string | null;
  modelId?: string | null;
}): string | null {
  const provider = providerId?.trim().toLowerCase() ?? '';
  const model = modelId?.trim().toLowerCase() ?? '';
  const combined = `${provider}:${model}`;

  if (
    provider.includes('anthropic') ||
    model.includes('claude') ||
    combined.includes('copilot:claude')
  ) {
    return getAgentAvatarUrlById('claude');
  }

  if (
    provider.includes('openai') ||
    model.includes('gpt') ||
    model.includes('codex')
  ) {
    return getAgentAvatarUrlById('openai');
  }

  if (
    provider.includes('google') ||
    model.includes('gemini') ||
    type === AgentType.ADK
  ) {
    return getAgentAvatarUrlById('gemini');
  }

  if (model.includes('qwen')) {
    return getAgentAvatarUrlById('qwen');
  }

  return getAgentAvatarUrlById(type ? DEFAULT_AVATAR_BY_TYPE[type] : null);
}
