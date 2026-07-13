import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { PLAN_REVIEWER_PROMPT } from '../prompts/prompts';
import { GPT_5_5 } from '../models/models';

export const createPlanReviewer: CreateAgentInput = {
  slug: 'plan-reviewer',
  name: 'Plan Reviewer',
  type: AgentType.OPENCODE,
  providerId: GPT_5_5.providerId,
  modelId: GPT_5_5.modelId,
  avatarUrl: getAgentAvatarUrlById('angus'),
  description: 'Reviews implementation plans and sends them back for revision when needed.',
  systemPrompt: PLAN_REVIEWER_PROMPT,
  statusTriggers: [TaskStatus.FOR_REVIEW],
  tagTriggers: ['plan'],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
