import type {
  AgentResponseDto,
  TaskResponseDto,
  ThreadResponseDto,
} from "@taico/client/v2";
import type {
  InputRequestLike,
  RunMode,
} from "./types.js";
import type { PreparedRepo } from "./helpers/prepareWorkspace.js";
import type { SkippedProject } from "./helpers/projectRepos.js";

export type WorkspaceContext = {
  cwd: string;
  repos: PreparedRepo[];
  skipped: SkippedProject[];
};

const SKIPPED_REASON_TEXT: Record<SkippedProject['reason'], string> = {
  not_found: 'project not found',
  no_repo_url: 'project has no repository URL',
};

/**
 * Only emitted when there is something the agent could not infer from its cwd:
 * several repositories, or project tags that could not be prepared.
 */
export function buildWorkspaceInstructions(workspace?: WorkspaceContext): string[] {
  if (!workspace) {
    return [];
  }
  const { cwd, repos, skipped } = workspace;
  if (repos.length <= 1 && skipped.length === 0) {
    return [];
  }

  const lines = ['', 'Workspace:'];
  if (repos.length > 1) {
    lines.push(
      `- This task is tagged with ${repos.length} projects. Each repository is cloned in its own folder under your working directory "${cwd}":`,
      ...repos.map((repo) => `  - project:${repo.slug} -> ${repo.dir} (${repo.repoUrl})`),
      '- Each folder is an independent git repository: run git commands, branches, builds and PRs from inside the relevant folder.',
    );
  } else if (repos.length === 1) {
    lines.push(`- Repository for project:${repos[0].slug} is at ${repos[0].dir}.`);
  }
  if (skipped.length > 0) {
    lines.push(
      '- The following project tags could not be prepared and have no local folder:',
      ...skipped.map((project) => `  - project:${project.slug} (${SKIPPED_REASON_TEXT[project.reason]})`),
    );
  }
  return lines;
}

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

/**
 * What to send after the agent's first turn. Input request runs are told to
 * answer and stop, so they never get one.
 */
export function buildFollowUpPrompt(
  agent: AgentResponseDto,
  mode: RunMode,
): string | undefined {
  if (mode !== 'normal') {
    return undefined;
  }
  return agent.followUpPrompt?.trim() || undefined;
}

export function buildPrompt(
  task: TaskResponseDto,
  agent: AgentResponseDto,
  mode: RunMode,
  inputRequest?: InputRequestLike,
  thread?: ThreadResponseDto | null,
  workspace?: WorkspaceContext,
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
    ...buildWorkspaceInstructions(workspace),
    '',
    agent.systemPrompt,
  ].join('\n');
}