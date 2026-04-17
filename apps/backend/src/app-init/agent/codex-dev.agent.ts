import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { DEV_PROMPT } from '../prompts/prompts';
import { CODEX } from '../models/models';

export const createCodexDev: CreateAgentInput = {
  slug: 'gpt-codex-dev',
  name: 'GPT Codex Developer',
  type: AgentType.OPENCODE,
  providerId: CODEX.providerId,
  modelId: CODEX.modelId,
  avatarUrl: getAgentAvatarUrlById('openai'),
  description:
    'GPT Codex with a Developer persona, running on an Opencode harness',
  systemPrompt: DEV_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
