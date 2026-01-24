import { CreateAgentInput } from "src/agents/dto/service/agents.service.types";
import { AgentType } from "src/agents/enums";
import { TaskStatus } from "src/tasks/enums";
import { DEV_PROMPT } from "./prompts";

export const createCodexDev: CreateAgentInput = {
  slug: 'gpt-codex-dev',
  name: 'GPT-5.2-Codex Developer',
  type: AgentType.OPENCODE,
  avatarUrl: '/icons/OpenAI-white-monoblossom.svg',
  description: 'GPT-5.2-Codex with a Developer persona, running on a Opencode harness',
  systemPrompt: DEV_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
}