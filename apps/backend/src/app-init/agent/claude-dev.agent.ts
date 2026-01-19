import { CreateAgentInput } from "src/agents/dto/service/agents.service.types";
import { AgentType } from "src/agents/enums";
import { TaskStatus } from "src/tasks/enums";

export const createClaudeDev: CreateAgentInput = {
  slug: 'claude-dev',
  name: 'Claude developer',
  type: AgentType.CLAUDE,
  description: 'Claude Code with a developer persona',
  systemPrompt: 'Execute the /start-task command with the dev persona',
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
}