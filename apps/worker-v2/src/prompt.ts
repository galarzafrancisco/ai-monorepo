import type {
  AgentResponseDto,
  TaskResponseDto,
  ThreadResponseDto,
} from "@taico/client/v2";
import type {
  InputRequestLike,
  RunMode,
} from "./types.js";

function buildThreadContextInstructions(task: TaskResponseDto, thread: ThreadResponseDto): string[] {
  return [
    '',
    'Thread context:',
    `- This task belongs to thread "${thread.id}" (${thread.title}).`,
    `- This task is ${thread.parentTaskId === task.id ? 'the parent task' : 'an attached task'} in that thread.`,
    `- Read shared thread memory at the start via mcp__context__get_thread_state_memory with threadId "${thread.id}".`,
    `- Check sibling task status via mcp__tasks__list_tasks_by_thread with threadId "${thread.id}".`,
    `- Keep decisions aligned with this shared memory and thread-level goal, not only this single task.`,
  ];
}

export function buildPrompt(
  task: TaskResponseDto,
  agent: AgentResponseDto,
  mode: RunMode,
  inputRequest?: InputRequestLike,
  thread?: ThreadResponseDto | null,
) {
  const threadContextInstructions = thread
    ? buildThreadContextInstructions(task, thread)
    : [];

  if (mode === 'input_request' && inputRequest) {
    return [
      `You got triggered by an unanswered input request in task "${task.id}".`,
      'You were asked a question and only need to answer that question.',
      'Do not go through the normal flow and do not complete the task unless explicitly requested.',
      '',
      `Input request id: ${inputRequest.id}`,
      `Question: ${String(inputRequest.question ?? '')}`,
      '',
      ...threadContextInstructions,
      '',
      'Fetch the task, answer the input request assigned to you, and stop there.',
    ].join('\n');
  }

  return [
    `You got triggered by new activity in task "${task.id}".`,
    'Fetch the task and proceed according to the following instructions.',
    ...threadContextInstructions,
    '',
    agent.systemPrompt,
  ].join('\n');
}