import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { AgentType } from 'src/agents/enums';
import { TaskStatus } from 'src/tasks/enums';
import { DEV_PROMPT } from './prompts';

export const createQwen3CoderNext: CreateAgentInput = {
  slug: 'qwen3-coder-next',
  name: 'Qwen3 Coder Next',
  type: AgentType.OPENCODE,
  avatarUrl: '/icons/qwen.png',
  description:
    'Qwen3 Coder Next with a developer persona',
  introduction: "I'm an ok developer. I can do simple things. I'm cheap. Use me when the task is not too complex.",
  systemPrompt: DEV_PROMPT,
  statusTriggers: [TaskStatus.NOT_STARTED],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
  providerId: 'spark-qwen3-coder-next-fp8',
  modelId: 'Qwen/Qwen3-Coder-Next-FP8',
};
