import { RunAssignedWireEvent, StopRequestedWireEvent } from '@taico/events';
import {
  ApiError,
  createTaicoClient,
  type AgentResponseDto,
  type ProjectResponseDto,
  type TaskResponseDto,
  type ThreadResponseDto,
} from '@taico/client';
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

export class ExecutionOrchestrator {
  private readonly activeExecutionIds = new Set<string>();
  private readonly client;

  constructor(private readonly options: ExecutionOrchestratorOptions) {
    this.client = createTaicoClient({
      baseUrl: options.serverUrl,
      token: options.workerAccessToken,
    });
  }

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
    task: TaskResponseDto,
    agent: AgentResponseDto,
    thread: ThreadResponseDto | null,
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

  private async fetchTask(taskId: string): Promise<TaskResponseDto> {
    return this.client.TaskService.tasksControllerGetTask(taskId);
  }

  private async fetchThreadByTaskId(
    taskId: string,
  ): Promise<ThreadResponseDto | null> {
    try {
      return await this.client.ThreadsService.threadsControllerGetThreadByTaskId(
        taskId,
      );
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      if (error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  private async fetchAgentByActorId(actorId: string): Promise<AgentResponseDto> {
    const response = await this.client.AgentService.agentsControllerListAgents(
      undefined,
      1,
      200,
    );
    const agent = response.items.find((item) => item.actorId === actorId);
    if (!agent) {
      throw new Error(`No agent found for actor ${actorId}`);
    }
    return agent;
  }

  private async requestExecutionToken(agentSlug: string): Promise<string> {
    const response =
      await this.client.AgentExecutionTokensService.agentExecutionTokensControllerRequestExecutionToken(
        agentSlug,
        {
          scopes: [
            'mcp:use',
            'tasks:read',
            'tasks:write',
            'context:read',
            'context:write',
          ],
          expirationSeconds: 3600,
        },
      );

    return response.token;
  }

  private async resolveRepoUrl(tags: TaskResponseDto['tags']): Promise<string | null> {
    const projectTag = tags.find((tag) => tag.name.startsWith('project:'));
    if (!projectTag) {
      return null;
    }

    const slug = projectTag.name.slice('project:'.length);
    if (!slug) {
      return null;
    }

    try {
      const project =
        await this.client.MetaProjectsService.projectsControllerGetProjectBySlug(
          slug,
        );
      return project.repoUrl ?? null;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return `HTTP ${error.status} when requesting ${error.url}: ${error.statusText}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }
}
