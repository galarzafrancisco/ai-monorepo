import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { DEV_PROMPT } from './prompts';

export const createClaudeDev: CreateAgentInput = {
  slug: 'claude-dev',
  name: 'Claude developer',
  type: AgentType.CLAUDE,
  description:
    'Claude Code with a developer persona running via Claude Code SDK',
  systemPrompt: DEV_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};
