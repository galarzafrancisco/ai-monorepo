import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { LEAD_PROMPT } from '../prompts/prompts';
import { CODEX } from '../models/models';

export const createLead: CreateAgentInput = {
  slug: 'lead',
  name: 'Lead',
  type: AgentType.CODEX,
  providerId: CODEX.providerId,
  modelId: CODEX.modelId,
  description:
    'Leads a team of subagents to achieve an outcome. Breaks down a goal into planning and implementation.',
  systemPrompt: LEAD_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  avatarUrl: getAgentAvatarUrlById('angus'),
  concurrencyLimit: 2,
};
