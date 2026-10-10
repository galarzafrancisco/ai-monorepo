import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TAICO_PROMPT } from '../prompts/prompts';

export const createTaico: CreateAgentInput = {
  slug: 'taico',
  name: 'Taico',
  type: AgentType.OTHER,
  description:
    'System operator powered by the Vercel AI SDK',
  systemPrompt: TAICO_PROMPT,
  statusTriggers: [],
  allowedTools: [],
  isActive: true,
  avatarUrl: getAgentAvatarUrlById('taico'),
  concurrencyLimit: 10,
};
