/**
 * Execution Orchestrator
 *
 * Handles server-assigned task executions in the new worker model.
 * Listens to run assignment events from WorkersGateway and executes tasks
 * using the appropriate agent runner, then reports lifecycle updates back.
 *
 * This replaces the old worker's local scheduling and dependency checking logic.
 * The worker is now a pure executor - the backend decides what to run.
 */

import { RunAssignedWireEvent } from '@taico/events';
import { WorkerGatewayClient } from './worker-gateway-client';
import { BaseAgentRunner } from './runners/base-agent-runner';
import { ClaudeAgentRunner } from './runners/claude-agent-runner';
import { prepareWorkspace } from './helpers/prepare-workspace';
import { getSession, setSession } from './helpers/session-store';
import { AgentModelConfig } from './runners/agent-runner.types';

type AgentSummary = {
  actorId: string;
  slug: string;
  name: string;
  type: string;
  systemPrompt: string;
  concurrencyLimit?: number | null;
  providerId?: string | null;
  modelId?: string | null;
};

type TaskSummary = {
  id: string;
  name: string;
  description: string;
  status: string;
  tags?: Array<{ name: string }>;
};

type ProjectSummary = {
  slug: string;
  repoUrl?: string | null;
};

type ThreadSummary = {
  id: string;
  title: string;
  parentTaskId?: string | null;
};

export class ExecutionOrchestrator {
  private activeExecutions = new Set<string>();

  constructor(
    private readonly gatewayClient: WorkerGatewayClient,
    private readonly serverUrl: string,
    private readonly accessToken: string,
    private readonly debug: boolean = false,
  ) {}

  /**
   * Start listening for run assignments and executing them
   */
  start(): void {
    this.gatewayClient.onRunAssigned((event) => {
      void this.handleRunAssignment(event);
    });

    this.gatewayClient.onStopRequested((event) => {
      console.log('[orchestrator] Stop requested for execution:', event.executionId);
      // TODO: Implement graceful cancellation
      // For now, just log it. In future, we'd need to track running processes
      // and send them cancellation signals.
    });

    console.log('[orchestrator] Started and ready to handle run assignments');
  }

  private async handleRunAssignment(event: RunAssignedWireEvent): Promise<void> {
    const { executionId, taskId, agentActorId } = event;

    console.log('[orchestrator] Received run assignment:', {
      executionId,
      taskId,
      agentActorId,
    });

    // Prevent duplicate execution
    if (this.activeExecutions.has(executionId)) {
      console.warn(
        `[orchestrator] Execution ${executionId} is already running. Ignoring duplicate assignment.`,
      );
      return;
    }

    this.activeExecutions.add(executionId);

    try {
      await this.executeTask(executionId, taskId, agentActorId);
    } catch (error) {
      console.error(
        `[orchestrator] Failed to execute task ${taskId}:`,
        error,
      );
      // Report failure
      try {
        await this.gatewayClient.reportRunFailed(
          executionId,
          error instanceof Error ? error.message : String(error),
        );
      } catch (reportError) {
        console.error(
          `[orchestrator] Failed to report run failure:`,
          reportError,
        );
      }
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private async executeTask(
    executionId: string,
    taskId: string,
    agentActorId: string,
  ): Promise<void> {
    // Fetch task details
    const task = await this.fetchTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Fetch agent details
    const agent = await this.fetchAgentByActorId(agentActorId);
    if (!agent) {
      throw new Error(`Agent with actorId ${agentActorId} not found`);
    }

    console.log(`[orchestrator] Executing task "${task.name}" with agent @${agent.slug}`);

    // Determine workspace repository
    let repoUrl: string | null = null;
    const projectTag = task.tags?.find((tag) => tag.name.startsWith('project:'));
    if (projectTag) {
      const projectSlug = projectTag.name.replace('project:', '');
      const project = await this.fetchProjectBySlug(projectSlug);
      if (project?.repoUrl) {
        repoUrl = project.repoUrl;
        console.log(`[orchestrator] Using project repo: ${repoUrl}`);
      }
    }

    // Prepare workspace
    const workDir = await prepareWorkspace(taskId, agentActorId, repoUrl);
    console.log(`[orchestrator] Workspace ready: ${workDir}`);

    // Load session for resume capability
    const sessionId = getSession(agentActorId, taskId);

    // Fetch thread context if task belongs to a thread
    const thread = await this.fetchThreadByTaskId(taskId);

    // Build prompt
    const prompt = this.buildPrompt(task, agent, thread);

    // Create agent runner
    const runner = this.createRunner(agent);
    if (!runner) {
      throw new Error(
        `Agent type "${agent.type}" not supported by this worker`,
      );
    }

    // Report run started
    await this.gatewayClient.reportRunStarted(executionId);
    console.log(`[orchestrator] Reported run started: ${executionId}`);

    try {
      // Execute the run
      const result = await runner.run(
        {
          taskId: task.id,
          prompt,
          cwd: workDir,
          executionId,
          resume: sessionId ?? undefined,
          agentSlug: agent.slug,
        },
        {
          onEvent: (message: string) => {
            if (this.debug) {
              console.log(`[agent message] ⤵️`);
              console.log(message);
              console.log('[end of agent message] ⤴️');
            }
            // TODO: Publish activity to backend for real-time UI updates
            // This would require a new WebSocket event or HTTP endpoint
          },
          onSession: (runnerSessionId: string) => {
            if (runnerSessionId) {
              setSession(agentActorId, taskId, runnerSessionId);
            }
          },
          onError: (error: { message: string; rawMessage?: any }) => {
            console.log('[orchestrator] Error detected during execution');
            console.log('error message:', error.message);
            if (this.debug) {
              console.log('raw message', error.rawMessage);
            }
            // TODO: Post error to task as a comment via HTTP
          },
        },
      );

      console.log(`[orchestrator] Execution completed successfully`);
      if (this.debug) {
        console.log(`[orchestrator] Result:`, result);
      }

      // Report run completed
      await this.gatewayClient.reportRunCompleted(executionId);
      console.log(`[orchestrator] Reported run completed: ${executionId}`);
    } catch (error) {
      console.error(`[orchestrator] Execution failed:`, error);
      throw error; // Re-throw to be handled by caller
    }
  }

  private buildPrompt(
    task: TaskSummary,
    agent: AgentSummary,
    thread?: ThreadSummary | null,
  ): string {
    const threadContextInstructions = thread
      ? [
          '',
          'Thread context:',
          `- This task belongs to thread "${thread.id}" (${thread.title}).`,
          `- This task is ${thread.parentTaskId === task.id ? 'the parent task' : 'an attached task'} in that thread.`,
          `- Read shared thread memory at the start via mcp__context__get_thread_state_memory with threadId "${thread.id}".`,
          `- Check sibling task status via mcp__tasks__list_tasks_by_thread with threadId "${thread.id}".`,
          `- Keep decisions aligned with this shared memory and thread-level goal, not only this single task.`,
        ]
      : [];

    return [
      `You got triggered by new activity in task "${task.id}".`,
      'Fetch the task and proceed according to the following instructions.',
      ...threadContextInstructions,
      '',
      agent.systemPrompt,
    ].join('\n');
  }

  private createRunner(agent: AgentSummary): BaseAgentRunner | null {
    const modelConfig: AgentModelConfig = {
      providerId: agent.providerId ?? undefined,
      modelId: agent.modelId ?? undefined,
    };

    switch (agent.type) {
      case 'claude':
        return new ClaudeAgentRunner(
          modelConfig,
          this.serverUrl,
          this.accessToken,
        );
      // TODO: Add other runner types as they're ported
      // case 'opencode':
      //   return new OpencodeAgentRunner(modelConfig, ...);
      // case 'adk':
      //   return new ADKAgentRunner(modelConfig, ...);
      // case 'githubcopilot':
      //   return new GitHubCopilotAgentRunner(modelConfig, ...);
      default:
        return null;
    }
  }

  // ========== HTTP API Calls ==========

  private async fetchTask(taskId: string): Promise<TaskSummary | null> {
    try {
      const response = await fetch(
        `${this.serverUrl}/api/v1/tasks/tasks/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch task ${taskId}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return (await response.json()) as TaskSummary;
    } catch (error) {
      console.error(`Error fetching task ${taskId}:`, error);
      return null;
    }
  }

  private async fetchAgentByActorId(
    actorId: string,
  ): Promise<AgentSummary | null> {
    try {
      // First, list all agents to find the one with matching actorId
      const response = await fetch(`${this.serverUrl}/api/v1/agents`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        console.error(
          `Failed to list agents: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const payload = (await response.json()) as {
        items: AgentSummary[];
      };

      const agent = payload.items.find((a) => a.actorId === actorId);
      return agent ?? null;
    } catch (error) {
      console.error(`Error fetching agent by actorId ${actorId}:`, error);
      return null;
    }
  }

  private async fetchProjectBySlug(
    slug: string,
  ): Promise<ProjectSummary | null> {
    try {
      const response = await fetch(
        `${this.serverUrl}/api/v1/projects/${slug}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        console.error(
          `Failed to fetch project ${slug}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return (await response.json()) as ProjectSummary;
    } catch (error) {
      console.error(`Error fetching project ${slug}:`, error);
      return null;
    }
  }

  private async fetchThreadByTaskId(
    taskId: string,
  ): Promise<ThreadSummary | null> {
    try {
      const response = await fetch(
        `${this.serverUrl}/api/v1/threads/by-task/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Task doesn't belong to a thread, which is fine
        }
        console.error(
          `Failed to fetch thread for task ${taskId}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return (await response.json()) as ThreadSummary;
    } catch (error) {
      console.error(`Error fetching thread for task ${taskId}:`, error);
      return null;
    }
  }
}
