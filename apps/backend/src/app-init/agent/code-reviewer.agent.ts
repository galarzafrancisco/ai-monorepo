import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { REVIEWER_PROMPT } from '../prompts/prompts';
import { CODEX } from '../models/models';

export const createCodeReviewer: CreateAgentInput = {
  slug: 'code-reviewer',
  name: 'Code Reviewer',
  type: AgentType.OPENCODE,
  providerId: CODEX.providerId,
  modelId: CODEX.modelId,
  description:
    'Automated code reviewer that examines PRs and provides feedback on tasks marked for review',
  systemPrompt: REVIEWER_PROMPT,
  statusTriggers: [TaskStatus.FOR_REVIEW],
  tagTriggers: ['code'],
  allowedTools: [],
  isActive: true,
  avatarUrl: getAgentAvatarUrlById('cockatoo'),
  concurrencyLimit: 1,
};
