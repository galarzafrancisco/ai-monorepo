import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { ASSISTANT_PROMPT } from './prompts';

export const createGeminiAssistant: CreateAgentInput = {
  slug: 'gemini-assistant',
  name: 'Gemini Assistant',
  type: AgentType.ADK,
  avatarUrl: '/icons/agent-development-kit.png',
  description: 'Gemini 2.5 Flash with an assistant persona, running on a ADK',
  systemPrompt: ASSISTANT_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
