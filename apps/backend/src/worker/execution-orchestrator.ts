import { RunAssignedWireEvent, StopRequestedWireEvent } from '@taico/events';
import { prepareWorkspace } from './helpers/prepare-workspace';
import { getSession, setSession } from './helpers/session-store';
import { ClaudeAgentRunner } from './runners/claude-agent-runner';
import { OpencodeAgentRunner } from './runners/opencode-agent-runner';
import { AgentRunner } from './runners/agent-runner.types';
import { WorkerGatewayClient } from './worker-gateway-client';

type ExecutionOrchestratorOptions = {
  serverUrl: string;
  workerAccessToken: string;
  gatewayClient: WorkerGatewayClient;
};

type TaskTag = {
  id: string;
  name: string;
};

type TaskResponse = {
  id: string;
  name: string;
  description?: string;
  tags?: TaskTag[];
};

type ThreadResponse = {
  id: string;
  title: string;
  parentTaskId: string;
};

type AgentResponse = {
  actorId: string;
  slug: string;
  type: string;
  systemPrompt: string;
  providerId?: string | null;
  modelId?: string | null;
};

type AgentListResponse = {
  items: AgentResponse[];
};

type ProjectResponse = {
  id: string;
  slug: string;
  repoUrl?: string | null;
};

export class ExecutionOrchestrator {
  private readonly activeExecutionIds = new Set<string>();

  constructor(private readonly options: ExecutionOrchestratorOptions) {}

  bind(): void {
    this.options.gatewayClient.onRunAssigned((event) => {
      void this.handleRunAssigned(event);
    });

    this.options.gatewayClient.onStopRequested((event) => {
      this.handleStopRequested(event);
    });
  }

  private async handleRunAssigned(event: RunAssignedWireEvent): Promise<void> {
    if (this.activeExecutionIds.has(event.executionId)) {
      console.warn(
        `[worker] received duplicate run assignment for execution ${event.executionId}`,
      );
      return;
    }

    this.activeExecutionIds.add(event.executionId);

    try {
      await this.options.gatewayClient.reportRunStarted(event.executionId);
      await this.executeAssignedRun(event);
      await this.options.gatewayClient.reportRunCompleted(event.executionId);
    } catch (error: unknown) {
      const reason = this.errorToMessage(error);
      console.error(
        `[worker] execution ${event.executionId} failed: ${reason}`,
        error,
      );
      await this.options.gatewayClient.reportRunFailed(event.executionId, reason);
    } finally {
      this.activeExecutionIds.delete(event.executionId);
    }
  }

  private handleStopRequested(event: StopRequestedWireEvent): void {
    if (!this.activeExecutionIds.has(event.executionId)) {
      console.log(
        `[worker] stop requested for non-running execution ${event.executionId}`,
      );
      return;
    }

    console.log(
      `[worker] stop requested for execution ${event.executionId}; cancellation is not yet implemented`,
    );
  }

  private async executeAssignedRun(event: RunAssignedWireEvent): Promise<void> {
    const task = await this.fetchTask(event.taskId);
    const agent = await this.fetchAgentByActorId(event.agentActorId);
    if (!agent.systemPrompt) {
      throw new Error(`Agent @${agent.slug} has no system prompt configured`);
    }

    const executionToken = await this.requestExecutionToken(agent.slug);
    const repoUrl = await this.resolveRepoUrl(task.tags ?? []);
    const workspaceDir = await prepareWorkspace(task.id, agent.actorId, repoUrl);
    const thread = await this.fetchThreadByTaskId(task.id);
    const runner = this.createRunner(agent.type);

    console.log(
      `[worker] executing ${event.executionId} for task ${task.id} with @${agent.slug} in ${workspaceDir}`,
    );

    await runner.run(
      {
        taskId: task.id,
        prompt: this.buildPrompt(task, agent, thread),
        cwd: workspaceDir,
        executionId: event.executionId,
        accessToken: executionToken,
        baseUrl: this.options.serverUrl,
        resume: getSession(agent.actorId, task.id) ?? undefined,
        agentSlug: agent.slug,
        options: {
          model:
            agent.providerId && agent.modelId
              ? `${agent.providerId}/${agent.modelId}`
              : undefined,
        },
      },
      {
        onEvent: async (message) => {
          console.log(`[worker][${event.executionId}] ${message}`);
        },
        onSession: async (sessionId) => {
          setSession(agent.actorId, task.id, sessionId);
        },
        onError: async (runnerError) => {
          console.error(
            `[worker][${event.executionId}] runner error: ${runnerError.message}`,
            runnerError.rawMessage,
          );
        },
      },
    );
  }

  private createRunner(agentType: string): AgentRunner {
    if (agentType === 'claude') {
      return new ClaudeAgentRunner();
    }

    if (agentType === 'opencode') {
      return new OpencodeAgentRunner();
    }

    throw new Error(
      `Agent type "${agentType}" is not yet supported by backend worker mode`,
    );
  }

  private buildPrompt(
    task: TaskResponse,
    agent: AgentResponse,
    thread: ThreadResponse | null,
  ): string {
    const lines: string[] = [
      `You got triggered by new activity in task "${task.id}".`,
      'Fetch the task and proceed according to the following instructions.',
    ];

    if (thread) {
      lines.push(
        '',
        'Thread context:',
        `- This task belongs to thread "${thread.id}" (${thread.title}).`,
        `- This task is ${thread.parentTaskId === task.id ? 'the parent task' : 'an attached task'} in that thread.`,
        `- Read shared thread memory at the start via mcp__context__get_thread_state_memory with threadId "${thread.id}".`,
        `- Check sibling task status via mcp__tasks__list_tasks_by_thread with threadId "${thread.id}".`,
        '- Keep decisions aligned with this shared memory and thread-level goal, not only this single task.',
      );
    }

    lines.push('', agent.systemPrompt);
    return lines.join('\n');
  }

  private async fetchTask(taskId: string): Promise<TaskResponse> {
    return this.fetchJson<TaskResponse>(`/api/v1/tasks/tasks/${taskId}`);
  }

  private async fetchThreadByTaskId(taskId: string): Promise<ThreadResponse | null> {
    try {
      return await this.fetchJson<ThreadResponse>(`/api/v1/threads/by-task/${taskId}`);
    } catch (error: unknown) {
      const message = this.errorToMessage(error);
      if (message.includes('HTTP 404')) {
        return null;
      }
      throw error;
    }
  }

  private async fetchAgentByActorId(actorId: string): Promise<AgentResponse> {
    const response = await this.fetchJson<AgentListResponse>('/api/v1/agents?limit=200');
    const agent = response.items.find((item) => item.actorId === actorId);
    if (!agent) {
      throw new Error(`No agent found for actor ${actorId}`);
    }
    return agent;
  }

  private async requestExecutionToken(agentSlug: string): Promise<string> {
    const response = await this.fetchJson<{ token: string }>(
      `/api/v1/agents/${agentSlug}/execution-token`,
      {
        method: 'POST',
        body: JSON.stringify({
          scopes: ['tasks:read', 'tasks:write', 'context:read', 'context:write'],
          expirationSeconds: 3600,
        }),
      },
    );

    return response.token;
  }

  private async resolveRepoUrl(tags: TaskTag[]): Promise<string | null> {
    const projectTag = tags.find((tag) => tag.name.startsWith('project:'));
    if (!projectTag) {
      return null;
    }

    const slug = projectTag.name.slice('project:'.length);
    if (!slug) {
      return null;
    }

    try {
      const project = await this.fetchJson<ProjectResponse>(
        `/api/v1/meta/projects/by-slug/${slug}`,
      );
      return project.repoUrl ?? null;
    } catch (error: unknown) {
      const message = this.errorToMessage(error);
      if (message.includes('HTTP 404')) {
        return null;
      }
      throw error;
    }
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.options.serverUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.workerAccessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} when requesting ${path}: ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }
}
