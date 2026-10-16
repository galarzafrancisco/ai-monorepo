import { StopCondition, ToolSet } from 'ai';

/** How many identical steps in a row end a turn. */
export const MAX_REPEATED_TOOL_CALLS = 3;

type StepLike = { toolCalls: Array<{ toolName: string; input: unknown }> };

/** One step's tool calls as a comparable string, or null for a step that called no tools. */
function signature(step: StepLike): string | null {
  if (step.toolCalls.length === 0) {
    return null;
  }
  return JSON.stringify(step.toolCalls.map((call) => [call.toolName, call.input ?? null]));
}

/**
 * The tool calls the model has repeated in its last `times` steps, or null if
 * it has not. A model that picks the wrong tool can keep calling it with the
 * same input and getting the same result until it runs out of steps.
 */
export function findRepeatedToolCall(
  steps: StepLike[],
  times: number = MAX_REPEATED_TOOL_CALLS,
): { toolNames: string[]; times: number } | null {
  if (steps.length < times) {
    return null;
  }
  const last = steps.slice(-times);
  const first = signature(last[0]);
  if (first === null || last.some((step) => signature(step) !== first)) {
    return null;
  }
  return { toolNames: last[0].toolCalls.map((call) => call.toolName), times };
}

/** Ends the turn once the model makes the same tool calls `times` steps in a row. */
export function isRepeatedToolCall(times: number = MAX_REPEATED_TOOL_CALLS): StopCondition<ToolSet> {
  return ({ steps }) => findRepeatedToolCall(steps, times) !== null;
}
