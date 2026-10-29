import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { DEV_PROMPT } from '../prompts/prompts';
import { GROK_4_7 } from '../models/models';

export const createGrokDev: CreateAgentInput = {
  slug: 'grok-dev',
  name: 'Grok Developer',
  type: AgentType.OPENCODE,
  providerId: GROK_4_7.providerId,
  modelId: GROK_4_7.modelId,
  avatarUrl: getAgentAvatarUrlById('spacexai'),
  description: 'Grok 4.7 with a Developer persona, running on OpenCode',
  systemPrompt: DEV_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
