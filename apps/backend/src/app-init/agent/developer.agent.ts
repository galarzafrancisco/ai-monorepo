import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { DEV_PROMPT } from '../prompts/prompts';
import { GPT_5_5 } from '../models/models';

export const createDeveloper: CreateAgentInput = {
  slug: 'developer',
  name: 'Developer',
  type: AgentType.OPENCODE,
  providerId: GPT_5_5.providerId,
  modelId: GPT_5_5.modelId,
  avatarUrl: getAgentAvatarUrlById('openai'),
  description: 'Developer agent for implementation tasks.',
  systemPrompt: DEV_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
