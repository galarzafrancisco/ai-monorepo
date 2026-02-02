import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { MIDDLE_MANAGER_PROMPT } from './prompts';

export const createMiddleManager: CreateAgentInput = {
  slug: 'middle-manager',
  name: 'Middle Manager',
  type: AgentType.ADK,
  description:
    'The Middle Manager is omnipresent. It does not attend meetings. Loud only through the Thread State. Gets out of the way.',
  systemPrompt: MIDDLE_MANAGER_PROMPT,
  statusTriggers: [],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
