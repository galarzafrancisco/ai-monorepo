import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { SHIPPER_PROMPT, SHIPPER_FOLLOW_UP_PROMPT } from '../prompts/prompts';
import { GPT_6_1_TERRA } from '../models/models';

export const createShipper: CreateAgentInput = {
  slug: 'shipper',
  name: 'Shipper',
  type: AgentType.OPENCODE,
  providerId: GPT_6_1_TERRA.providerId,
  modelId: GPT_6_1_TERRA.modelId,
  avatarUrl: getAgentAvatarUrlById('openai'),
  description:
    'Merges reviewed PRs on self-ship tasks, watches the main build and closes the task',
  systemPrompt: SHIPPER_PROMPT,
  followUpPrompt: SHIPPER_FOLLOW_UP_PROMPT,
  statusTriggers: [TaskStatus.FOR_REVIEW],
  tagTriggers: ['self-ship'],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
