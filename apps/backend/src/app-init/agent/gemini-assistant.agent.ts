import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { getAgentAvatarUrlById } from 'src/agents/agent-avatar.library';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { ASSISTANT_PROMPT } from '../prompts/prompts';
import { GEMINI_FLASH } from '../models/models';

export const createGeminiAssistant: CreateAgentInput = {
  slug: 'gemini-assistant',
  name: 'Gemini Assistant',
  type: AgentType.ADK,
  modelId: GEMINI_FLASH.modelId,
  avatarUrl: getAgentAvatarUrlById('gemini'),
  description: 'Gemini 2.5 Flash with an assistant persona, running on a ADK',
  systemPrompt: ASSISTANT_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
