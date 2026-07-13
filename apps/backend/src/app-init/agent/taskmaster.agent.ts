import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { TASKMASTER_PROMPT } from '../prompts/prompts';
import { GPT_5_5 } from '../models/models';

export const createTaskmaster: CreateAgentInput = {
  slug: 'taskmaster',
  name: 'Taskmaster',
  type: AgentType.OPENCODE,
  providerId: GPT_5_5.providerId,
  modelId: GPT_5_5.modelId,
  avatarUrl: getAgentAvatarUrlById('bruce'),
  description: 'Taskmaster agent for breaking plans into implementation tasks.',
  systemPrompt: TASKMASTER_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
