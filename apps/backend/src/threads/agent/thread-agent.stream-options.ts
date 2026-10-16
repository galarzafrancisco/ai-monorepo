import { hasToolCall, isStepCount, ModelMessage, StopCondition, ToolSet } from 'ai';
import type { ResolvedChatModel } from './chat-model.builders';
import { STAY_SILENT_TOOL } from './thread-agent.prompts';
import { isRepeatedToolCall } from './repeated-tool-call';

export const THREAD_AGENT_MAX_STEPS = 25;

/** When a threads agent turn ends: the step limit, staying silent, or the model repeating itself. */
export const THREAD_AGENT_STOP_WHEN: Array<StopCondition<ToolSet>> = [
  isStepCount(THREAD_AGENT_MAX_STEPS),
  hasToolCall(STAY_SILENT_TOOL),
  isRepeatedToolCall(),
];

export type ThreadAgentStreamOptionsInput = {
  resolved: ResolvedChatModel;
  /** Already thread-scoped, see `buildThreadScopedInstructions`. */
  instructions: string;
  messages: ModelMessage[];
  tools: ToolSet;
};

/**
 * The model-facing part of a threads agent `streamText` call. The service adds
 * its own callbacks; the evals override `stopWhen` and strip tool executes.
 * Keeping both on this one function means the evals send what production sends.
 */
export function buildThreadAgentStreamOptions(input: ThreadAgentStreamOptionsInput) {
  return {
    model: input.resolved.model,
    instructions: input.instructions,
    messages: input.messages,
    tools: input.tools,
    providerOptions: input.resolved.providerOptions,
    stopWhen: THREAD_AGENT_STOP_WHEN,
  };
}
