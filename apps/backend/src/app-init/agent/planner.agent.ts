import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { PLANNER_PROMPT } from '../prompts/prompts';
import { GPT_5_5 } from '../models/models';

export const createPlanner: CreateAgentInput = {
  slug: 'planner',
  name: 'Planner',
  type: AgentType.OPENCODE,
  providerId: GPT_5_5.providerId,
  modelId: GPT_5_5.modelId,
  avatarUrl: getAgentAvatarUrlById('tracy'),
  description: 'Planner agent for creating implementation plans.',
  systemPrompt: PLANNER_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
