// Coordinator.ts
import { TaskWirePayload } from "@taico/events";
import {
  type AgentResponseDto,
  type TaskResponseDto,
  type ThreadResponseDto,
} from "@taico/client";
import { Taico } from "./Taico.js";
import {
  ACCESS_TOKEN,
  AGENT_SLUG,
  BASE_URL,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TASK_LIMIT,
} from "./helpers/config.js";
import { prepareWorkspace } from "./helpers/prepareWorkspace.js";
import { getSession, setSession } from "./helpers/sessionStore.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { SocketIOTasksTransport, TaskEvent } from "./SocketIOTasksTransport.js";
import { BaseAgentRunner } from "./runners/BaseAgentRunner.js";
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";
import { ADKAgentRunner } from "./runners/ADKAgentRunner.js";
import { GitHubCopilotAgentRunner } from "./runners/GitHubCopilotAgentRunner.js";
import { AgentModelConfig } from "./runners/AgentRunner.js";
import { AgentConcurrencyStore } from "./helpers/AgentConcurrencyStore.js";

type WorkerTask = TaskWirePayload | TaskResponseDto;

type InputRequestLike = {
  id: string;
  question: unknown;
  answer?: unknown;
  assignedToActorId: string;
};

type RunMode = "normal" | "input_request";

export class Coordinator {

  private ready: boolean = false;
  private transport: SocketIOTasksTransport;
  private client: Taico;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private readonly concurrencyStore = new AgentConcurrencyStore();
  private readonly activeTaskIds = new Set<string>();
  private currentAgent?: AgentResponseDto;

  // Make transport
  constructor() {
    this.transport = new SocketIOTasksTransport(
      BASE_URL,
      ACCESS_TOKEN,
      {
        namespace: '/tasks',
        // debug: true,
      }
    );

    this.client = new Taico(BASE_URL, ACCESS_TOKEN);
  }

  async connect(): Promise<boolean> {
    try {
      await this.transport.start();
      this.ready = true;
    } catch {
      this.ready = false;
    }
    return this.ready;
  }

  async start(): Promise<boolean> {
    // Connect
    if (!(await this.connect())) {
      return false;
    }

    // Listen
    this.transport.onTaskEvent(this.handleEvent);

    const heartbeatMs = Number.isFinite(HEARTBEAT_INTERVAL_MS) && HEARTBEAT_INTERVAL_MS > 0
      ? HEARTBEAT_INTERVAL_MS
      : 60_000;
    this.heartbeatTimer = setInterval(() => {
      void this.runHeartbeat();
    }, heartbeatMs);
    void this.runHeartbeat();

    return true;
  }

  private handleEvent = async (evt: TaskEvent) => {
    // For now just look at create and assign and status change
    if (evt.type === 'created' || evt.type === 'assigned' || evt.type === 'status_changed' || evt.type === 'updated') {
      console.log('--------------------------------------------------------');
      console.log('Event received');
      console.log(`- Type: ${evt.type}`);
      console.log(`- Task: ${evt.task.name}`);
      console.log(`- Actor: ${evt.actorId}`);
      console.log(`- Task status: ${evt.task.status}`);
      console.log(`- Task assignee: ${evt.task.assigneeActor?.id}`);
      const task = evt.task;
      if (task.assigneeActor?.id === evt.actorId) {
        console.log(`- Update caused by assignee. Ignoring as this is a self event. ❌`);
        return;
      }
      await this.maybeHandleInputRequest(task);
      await this.handleTask(task);
    }
  };

  private async runHeartbeat() {
    try {
      const limit = Number.isFinite(HEARTBEAT_TASK_LIMIT) && HEARTBEAT_TASK_LIMIT > 0
        ? Math.floor(HEARTBEAT_TASK_LIMIT)
        : 100;
      const tasks = await this.client.listTasks(1, limit);
      for (const task of tasks) {
        await this.maybeHandleInputRequest(task);
        await this.handleTask(task);
      }
    } catch (error) {
      console.error('[heartbeat] failed to reconcile tasks', error);
    }
  }

  private async handleTask(task: WorkerTask) {
    // Get the agent
    const actor = task.assigneeActor;
    if (!actor?.slug) {
      console.log(`- Task ${task.id} not assigned or missing actor slug. Skipping. ❌`);
      return;
    }
    const agent = await this.client.getAgent(actor.slug);
    if (!agent) {
      console.log(`- Agent @${actor.slug} not found. Skipping. ❌`);
      return;
    }
    console.log(`- Agent: @${agent.slug}`);
    if (agent.slug != AGENT_SLUG) {
      console.log(`- We only react to @${AGENT_SLUG}. Skipping. ❌`);
      return;
    }

    if (!(await this.canRunTaskNormally(task))) {
      return;
    }

    if (Array.isArray(agent.tagTriggers) && agent.tagTriggers.length > 0) {
      const taskTagNames = new Set((task.tags ?? []).map((tag) => tag.name));
      const matchesTagTrigger = agent.tagTriggers.some((tagTrigger) => taskTagNames.has(tagTrigger));
      if (!matchesTagTrigger) {
        console.log(`- Agent @${agent.slug} requires tag trigger and task has none. Skip. ❌`);
        return;
      }
    }

    // Do we have runners for this agent?
    if (agent.type !== "claude" && agent.type !== "opencode" && agent.type !== "adk" && agent.type !== "githubcopilot") {
      console.log(`- Agent @${actor.slug} of type "${agent.type}" not supported. Skipping. ❌`);
      return;
    }

    // Does the agent respond to this status?
    if (!agent.statusTriggers.includes(task.status)) {
      console.log(`- Agent @${agent.slug} doesn't react to status '${task.status}'. Skip. ❌`);
      return;
    }

    await this.executeTask(task, agent, 'normal');
  }

  private async maybeHandleInputRequest(task: WorkerTask): Promise<void> {
    const agent = await this.getCurrentAgent();
    if (!agent) {
      return;
    }

    const unansweredForMe = task.inputRequests.find((inputRequest) => {
      if (inputRequest.answer != null) {
        return false;
      }
      if (inputRequest.assignedToActorId !== agent.actorId) {
        return false;
      }
      return task.assigneeActor?.id !== agent.actorId;
    });

    if (!unansweredForMe) {
      return;
    }

    console.log(`- Unanswered input request ${unansweredForMe.id} assigned to @${agent.slug}. Triggering response flow.`);
    await this.executeTask(task, agent, 'input_request', unansweredForMe);
  }

  private async canRunTaskNormally(task: WorkerTask): Promise<boolean> {
    if (!(await this.dependenciesAreDone(task))) {
      return false;
    }

    const unresolvedInputRequests = task.inputRequests.filter((inputRequest) => inputRequest.answer == null);
    if (unresolvedInputRequests.length > 0) {
      console.log(`- Task ${task.id} has unresolved input requests. Skip until answered. ❌`);
      return false;
    }

    return true;
  }

  private async dependenciesAreDone(task: WorkerTask): Promise<boolean> {
    if (!Array.isArray(task.dependsOnIds) || task.dependsOnIds.length === 0) {
      return true;
    }

    for (const dependencyId of task.dependsOnIds) {
      const dependencyTask = await this.client.getTask(dependencyId);
      if (!dependencyTask) {
        console.log(`- Dependency task ${dependencyId} not found. Skip. ❌`);
        return false;
      }

      if (dependencyTask.status !== 'DONE') {
        console.log(`- Dependency task ${dependencyId} is ${dependencyTask.status}. Skip. ❌`);
        return false;
      }
    }

    return true;
  }

  private async getCurrentAgent(): Promise<AgentResponseDto | null> {
    if (this.currentAgent) {
      return this.currentAgent;
    }

    const agent = await this.client.getAgent(AGENT_SLUG);
    if (!agent) {
      console.log(`- Agent @${AGENT_SLUG} not found. ❌`);
      return null;
    }

    this.currentAgent = agent;
    return this.currentAgent;
  }

  private getConcurrencyLimit(agent: AgentResponseDto): number | null {
    if (typeof agent.concurrencyLimit === 'number' && Number.isFinite(agent.concurrencyLimit) && agent.concurrencyLimit > 0) {
      return Math.floor(agent.concurrencyLimit);
    }

    return null;
  }

  private buildThreadContextInstructions(task: WorkerTask, thread: ThreadResponseDto): string[] {
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

  private buildPrompt(
    task: WorkerTask,
    agent: AgentResponseDto,
    mode: RunMode,
    inputRequest?: InputRequestLike,
    thread?: ThreadResponseDto | null,
  ) {
    const threadContextInstructions = thread
      ? this.buildThreadContextInstructions(task, thread)
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

  private async executeTask(task: WorkerTask, agent: AgentResponseDto, mode: RunMode, inputRequest?: InputRequestLike) {
    if (this.activeTaskIds.has(task.id)) {
      console.log(`- Task ${task.id} is already running in this worker. Skip. ❌`);
      return;
    }

    const concurrencyLimit = this.getConcurrencyLimit(agent);
    if (!this.concurrencyStore.tryAcquire(agent.actorId, concurrencyLimit)) {
      console.log(`- Agent @${agent.slug} reached concurrency limit (${concurrencyLimit ?? 'unlimited'}). Skip. ❌`);
      return;
    }

    this.activeTaskIds.add(task.id);
    try {
      // Extract project slug from tags and get project repo URL
      let repoUrl: string | null = null;
      const projectTag = task.tags?.find((tag) => tag.name.startsWith('project:'));
      if (projectTag) {
        const projectSlug = projectTag.name.replace('project:', '');
        console.log(`- Found project tag: ${projectTag.name}, slug: ${projectSlug}`);

        const project = await this.client.getProjectBySlug(projectSlug);
        if (project) {
          console.log(`- Project found: ${project.slug}`);
          repoUrl = project.repoUrl ?? null;
          if (repoUrl) {
            console.log(`- Using project repo: ${repoUrl}`);
          } else {
            console.log(`- Project has no repoUrl, using default`);
          }
        } else {
          console.log(`- Project not found for slug: ${projectSlug}`);
        }
      }

      console.log(`- ✅ Conditions met. @${agent.slug} starting to work on task "${task.name}" 🦄`);

      // Load session
      const sessionId = getSession(agent.actorId, task.id);

      // Prep workspace
      const workDir = await prepareWorkspace(task.id, agent.actorId, repoUrl);
      console.log(`- workspace prepped`);

      const thread = await this.client.getThreadByTaskId(task.id);
      if (thread) {
        console.log(`- Task ${task.id} belongs to thread ${thread.id} (${thread.title})`);
      }

      const run = await this.client.startRun(task.id);
      if (!run) {
        console.error(`Failed to create a run ❌`);
        return;
      }
      console.log(`Started Agent Run ID ${run.id}`);

      // Create agent runner
      let runner: BaseAgentRunner | null = null;
      const modelConfig: AgentModelConfig = {
        providerId: agent.providerId ?? undefined,
        modelId: agent.modelId ?? undefined,
      };
      if (agent.type === 'claude') {
        runner = new ClaudeAgentRunner(modelConfig);
      } else if (agent.type === 'opencode') {
        runner = new OpencodeAgentRunner(modelConfig);
      } else if (agent.type === 'adk') {
        runner = new ADKAgentRunner(modelConfig);
      } else if (agent.type === 'githubcopilot') {
        runner = new GitHubCopilotAgentRunner(modelConfig);
      }

      // This shouldn't happen because we checked first, but let's satisfy TypeScript
      if (!runner) {
        console.log(`- Agent @${agent.slug} of type "${agent.type}" not supported. Skipping. ❌`);
        return;
      }

      try {

        const results = await runner.run(
          {
            taskId: task.id,
            prompt: this.buildPrompt(task, agent, mode, inputRequest, thread),
            cwd: workDir,
            runId: run.id,
            resume: sessionId ?? undefined,
            agentSlug: agent.slug,
          },
          {
            onEvent: (message: string) => {
              console.log(`[agent message] ⤵️`);
              console.log(message);
              console.log('[end of agent message] ⤴️');
              this.transport.publishActivity({
                taskId: task.id,
                message,
                ts: Date.now(),
              });
            },
            onSession: (runnerSessionId: string) => {
              if (runnerSessionId) {
                setSession(agent.actorId, task.id, runnerSessionId);
              }
            },
            onError: (error: { message: string; rawMessage?: any }) => {
              console.log('Error detected');
              console.log('error message:', error.message);
              console.log('raw message', error.rawMessage);

              // Post error to task as a comment
              this.client.addComment(
                task.id,
                `⚠️ Error Detected ⚠️\n\n${error.message}\n\n\`\`\`json\nraw message\n${JSON.stringify(error.rawMessage, null, 2)}\n\`\`\``
              );
            }
          }
        );

        console.log(results);
      } catch (error) {
        console.error(`Error running task`);
        console.error(error);
        // Force a comment
        this.client.addComment(task.id, `❌ Something went wrong ❌\n\n${error}`);
      }
    } finally {
      this.activeTaskIds.delete(task.id);
      this.concurrencyStore.release(agent.actorId);
    }
  }
}
