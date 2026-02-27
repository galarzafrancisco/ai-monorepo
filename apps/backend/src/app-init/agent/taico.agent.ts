import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { AgentType } from 'src/agents/enums';
import { TAICO_PROMPT } from './prompts';

export const createTaico: CreateAgentInput = {
  slug: 'taico',
  name: 'Taico',
  type: AgentType.OTHER,
  description:
    'System operator',
  systemPrompt: TAICO_PROMPT,
  statusTriggers: [],
  allowedTools: [],
  isActive: true,
  avatarUrl: '/apple-touch-icon.png',
  concurrencyLimit: 10,
};
