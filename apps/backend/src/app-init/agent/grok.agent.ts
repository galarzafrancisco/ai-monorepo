import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { HELPER_PROMPT } from '../prompts/prompts';
import { GROK_4_7 } from '../models/models';

export const createGrok: CreateAgentInput = {
  slug: 'grok',
  name: 'Grok',
  type: AgentType.OPENCODE,
  providerId: GROK_4_7.providerId,
  modelId: GROK_4_7.modelId,
  avatarUrl: getAgentAvatarUrlById('spacexai'),
  description: 'Grok 4.7 with a helper persona, running on OpenCode',
  systemPrompt: HELPER_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
