import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { AgentType } from 'src/agents/enums';
import { TAICO_PROMPT } from '../prompts/prompts';

const taicoAgentType =
  process.env.TAICO_AGENT_TYPE === AgentType.ADK
    ? AgentType.ADK
    : AgentType.OTHER;

export const createTaico: CreateAgentInput = {
  slug: 'taico',
  name: 'Taico',
  type: taicoAgentType,
  description:
    'System operator',
  systemPrompt: TAICO_PROMPT,
  statusTriggers: [],
  allowedTools: [],
  isActive: true,
  avatarUrl: '/apple-touch-icon.png',
  concurrencyLimit: 10,
};
