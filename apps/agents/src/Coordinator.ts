// Coordinator.ts
import { TaskWirePayload } from "@taico/events";
import type { AgentResponseDto, InputRequestResponseDto, TaskResponseDto } from "@taico/client";
import { Taico } from "./Taico.js";
import { ACCESS_TOKEN, AGENT_SLUG, BASE_URL } from "./helpers/config.js";
import { prepareWorkspace } from "./helpers/prepareWorkspace.js";
import { getSession, setSession } from "./helpers/sessionStore.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { SocketIOTasksTransport, TaskEvent } from "./SocketIOTasksTransport.js"
import { BaseAgentRunner } from "./runners/BaseAgentRunner.js";
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";
import { ADKAgentRunner } from "./runners/ADKAgentRunner.js";
import { AgentModelConfig } from "./runners/AgentRunner.js";
import { ConcurrencyStore } from "./helpers/ConcurrencyStore.js";

const HEARTBEAT_INTERVAL_MS = 60_000;
const HEARTBEAT_TASK_LIMIT = 100;

export class Coordinator {

  private ready: boolean = false;
  private transport: SocketIOTasksTransport;
  private client: Taico;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private readonly concurrencyStore = new ConcurrencyStore();
  private readonly inFlightTaskIds = new Set<string>();
  private readonly inFlightInputRequests = new Set<string>();

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
    this.startHeartbeat();

    return true;
  }

  private handleEvent = async (evt: TaskEvent) => {
    // For now just look at create and assign and status change
    if (evt.type === 'created' || evt.type === 'assigned' || evt.type === 'status_changed') {
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
      this.handleTask(task);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }

    this.runHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.runHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async runHeartbeat() {
    try {
      const taskList = await this.client.listTasks(1, HEARTBEAT_TASK_LIMIT);
      const tasks = taskList.items ?? [];
      const agentsList = await this.client.listAgents(true);
      const agentsByActorId = new Map(
        agentsList.items.map((agent) => [agent.actorId, agent])
      );
      const tasksById = new Map(tasks.map((task) => [task.id, task]));

      for (const task of tasks) {
        await this.handleTask(task, tasksById, agentsByActorId);
      }
    } catch (error) {
      console.error("[heartbeat] Failed to run heartbeat", error);
    }
  }

  private async handleTask(
    task: TaskWirePayload | TaskResponseDto,
    tasksById?: Map<string, TaskResponseDto>,
    agentsByActorId?: Map<string, AgentResponseDto>
  ) {
    const taskId = task.id;
    if (this.inFlightTaskIds.has(taskId)) {
      console.log(`- Task ${taskId} already in progress. Skipping. ⏳`);
      return;
    }

    const hydratedTask = await this.hydrateTask(task, tasksById);
    if (!hydratedTask) {
      console.log(`- Task ${taskId} no longer available. Skipping. ❌`);
      return;
    }

    const dependencyBlocked = await this.hasPendingDependencies(hydratedTask, tasksById);
    if (dependencyBlocked) {
      console.log(`- Task ${taskId} has pending dependencies. Skipping. ❌`);
      return;
    }

    const pendingInputRequests = this.getPendingInputRequests(hydratedTask);
    if (pendingInputRequests.length > 0) {
      await this.triggerInputRequests(hydratedTask, pendingInputRequests, agentsByActorId);
      console.log(`- Task ${taskId} has pending input requests. Skipping. ❌`);
      return;
    }

    // Get the agent
    const actor = hydratedTask.assigneeActor;
    if (!actor?.slug) {
      console.log(`- Task ${taskId} not assigned or missing actor slug. Skipping. ❌`);
      return;
    }
    const agent = agentsByActorId?.get(actor.id) ?? await this.client.getAgent(actor.slug);
    if (!agent) {
      console.log(`- Agent @${actor.slug} not found. Skipping. ❌`);
      return;
    }
    console.log(`- Agent: @${agent.slug}`);
    if (agent.slug != AGENT_SLUG) {
      console.log(`- We only react to @${AGENT_SLUG}. Skipping. ❌`);
      return;
    }

    // Do we have runners for this agent?
    if (agent.type !== "claude" && agent.type !== "opencode" && agent.type !== "adk") {
      console.log(`- Agent @${actor.slug} of type "${agent.type}" not supported. Skipping. ❌`);
      return;
    }

    // Does the agent respond to this status?
    if (!agent.statusTriggers.includes(hydratedTask.status)) {
      console.log(`- Agent @${agent.slug} doesn't react to status '${hydratedTask.status}'. Skip. ❌`);
      return;
    }

    if (agent.tagTriggers.length > 0) {
      const taskTags = new Set(hydratedTask.tags?.map((tag) => tag.name));
      const hasMatchingTag = agent.tagTriggers.some((tag) => taskTags.has(tag));
      if (!hasMatchingTag) {
        console.log(`- Agent @${agent.slug} requires tag triggers. Skip. ❌`);
        return;
      }
    }

    if (!this.concurrencyStore.canRun(agent.actorId, this.getConcurrencyLimit(agent))) {
      console.log(`- Agent @${agent.slug} at concurrency limit. Skip. ❌`);
      return;
    }

    // Extract project slug from tags and get project repo URL
    let repoUrl: string | null = null;
    repoUrl = await this.resolveRepoUrl(hydratedTask);

    console.log(`- ✅ Conditions met. @${agent.slug} starting to work on task "${task.name}" 🦄`);

    // Load session
    const sessionId = getSession(agent.actorId, taskId);

    this.inFlightTaskIds.add(taskId);
    let runStarted = false;

    try {
      // Prep workspace
      const workDir = await prepareWorkspace(taskId, agent.actorId, repoUrl);
      console.log(`- workspace prepped`);

      const run = await this.client.startRun(taskId);
      if (!run) {
        console.error(`Failed to create a run ❌`);
        return;
      }
      console.log(`Started Agent Run ID ${run.id}`);

      const runner = this.createRunner(agent);
      if (!runner) {
        console.log(`- Agent @${actor.slug} of type "${agent.type}" not supported. Skipping. ❌`);
        return;
      }

      this.concurrencyStore.increment(agent.actorId);
      runStarted = true;

      const results = await runner.run(
        {
          taskId,
          prompt: `You got triggered by new activity in task "${taskId}". Fetch the task and proceed according to the following instructions.\n\n\n ${agent.systemPrompt}`,
          cwd: workDir,
          runId: run.id,
        },
        {
          onEvent: (message: string) => {
            console.log(`[agent message] ⤵️`);
            console.log(message);
            console.log('[end of agent message] ⤴️')
            this.transport.publishActivity({
              taskId,
              message,
              ts: Date.now(),
            });
          },
          onSession: (sessionId: string) => {
            if (!sessionId) {
              setSession(agent.actorId, taskId, sessionId);
            }
          },
          onError: (error: { message: string; rawMessage?: any }) => {
            console.log('Error detected');
            console.log('error message:', error.message);
            console.log('raw message', error.rawMessage);

            // Post error to task as a comment
            this.client.addComment(
              taskId,
              `⚠️ Error Detected ⚠️\n\n${error.message}\n\n\`\`\`json\nraw message\n${JSON.stringify(error.rawMessage, null, 2)}\n\`\`\``
            );
          }
        }
      )

      console.log(results);

      // Force a comment
      this.client.addComment(taskId, `Finished.\n\n${results.result}`);
    } catch (error) {
      console.error(`Error running task`);
      console.error(error);
      // Force a comment
      this.client.addComment(taskId, `❌ Something went wrong ❌\n\n${error}`);
    } finally {
      if (runStarted) {
        this.concurrencyStore.decrement(agent.actorId);
      }
      this.inFlightTaskIds.delete(taskId);
    }
  }

  private createRunner(agent: AgentResponseDto): BaseAgentRunner | null {
    const modelConfig: AgentModelConfig = {
      providerId: agent.providerId ?? undefined,
      modelId: agent.modelId ?? undefined,
    };
    if (agent.type === 'claude') {
      return new ClaudeAgentRunner(modelConfig);
    }
    if (agent.type === 'opencode') {
      return new OpencodeAgentRunner(modelConfig);
    }
    if (agent.type === 'adk') {
      return new ADKAgentRunner(modelConfig);
    }

    return null;
  }

  private getConcurrencyLimit(agent: AgentResponseDto): number | null {
    if (typeof agent.concurrencyLimit === "number") {
      return agent.concurrencyLimit;
    }

    return null;
  }

  private getPendingInputRequests(task: TaskResponseDto | TaskWirePayload): InputRequestResponseDto[] {
    const inputRequests = task.inputRequests ?? [];
    return inputRequests.filter((request) => !request.answer && !request.resolvedAt);
  }

  private async triggerInputRequests(
    task: TaskResponseDto,
    pendingRequests: InputRequestResponseDto[],
    agentsByActorId?: Map<string, AgentResponseDto>
  ) {
    for (const inputRequest of pendingRequests) {
      if (task.assigneeActor?.id === inputRequest.assignedToActorId) {
        continue;
      }

      await this.triggerInputRequestAgent(task, inputRequest, agentsByActorId);
    }
  }

  private async triggerInputRequestAgent(
    task: TaskResponseDto,
    inputRequest: InputRequestResponseDto,
    agentsByActorId?: Map<string, AgentResponseDto>
  ) {
    const inputRequestId = inputRequest.id;
    if (this.inFlightInputRequests.has(inputRequestId)) {
      return;
    }

    const actorId = inputRequest.assignedToActorId;
    const agent = await this.getAgentByActorId(actorId, agentsByActorId);
    if (!agent) {
      console.log(`- Input request assignee ${actorId} not found. Skipping. ❌`);
      return;
    }

    if (!this.concurrencyStore.canRun(agent.actorId, this.getConcurrencyLimit(agent))) {
      console.log(`- Input request agent @${agent.slug} at concurrency limit. Skip. ❌`);
      return;
    }

    const runner = this.createRunner(agent);
    if (!runner) {
      console.log(`- Input request agent @${agent.slug} not supported. Skip. ❌`);
      return;
    }

    const repoUrl = await this.resolveRepoUrl(task);
    const taskId = task.id;
    const prompt = [
      `You were asked to answer an input request for task "${taskId}".`,
      `Input request id: ${inputRequest.id}`,
      `Question: ${inputRequest.question}`,
      "Respond to the input request. You do not need to complete the task or go through the normal flow, just answer the question.",
      "",
      agent.systemPrompt,
    ].join("\n");

    this.inFlightInputRequests.add(inputRequestId);
    let runStarted = false;

    try {
      const workDir = await prepareWorkspace(taskId, agent.actorId, repoUrl);
      const run = await this.client.startRun(taskId);
      if (!run) {
        console.error(`Failed to create input request run ❌`);
        return;
      }

      this.concurrencyStore.increment(agent.actorId);
      runStarted = true;

      await runner.run(
        {
          taskId,
          prompt,
          cwd: workDir,
          runId: run.id,
        },
        {
          onEvent: (message: string) => {
            console.log(`[agent message] ⤵️`);
            console.log(message);
            console.log('[end of agent message] ⤴️')
            this.transport.publishActivity({
              taskId,
              message,
              ts: Date.now(),
            });
          },
          onSession: (newSessionId: string) => {
            if (!newSessionId) {
              setSession(agent.actorId, taskId, newSessionId);
            }
          },
          onError: (error: { message: string; rawMessage?: any }) => {
            console.log('Error detected');
            console.log('error message:', error.message);
            console.log('raw message', error.rawMessage);

            this.client.addComment(
              taskId,
              `⚠️ Error Detected ⚠️\n\n${error.message}\n\n\`\`\`json\nraw message\n${JSON.stringify(error.rawMessage, null, 2)}\n\`\`\``
            );
          }
        }
      );
    } catch (error) {
      console.error(`Error running input request`);
      console.error(error);
      this.client.addComment(taskId, `❌ Something went wrong ❌\n\n${error}`);
    } finally {
      if (runStarted) {
        this.concurrencyStore.decrement(agent.actorId);
      }
      this.inFlightInputRequests.delete(inputRequestId);
    }
  }

  private async getAgentByActorId(
    actorId: string,
    agentsByActorId?: Map<string, AgentResponseDto>
  ): Promise<AgentResponseDto | null> {
    const agent = agentsByActorId?.get(actorId);
    if (agent) {
      return agent;
    }

    try {
      const agentsList = await this.client.listAgents(true);
      return agentsList.items.find((item) => item.actorId === actorId) ?? null;
    } catch (error) {
      console.error("Failed to load agents", error);
      return null;
    }
  }

  private async hydrateTask(
    task: TaskWirePayload | TaskResponseDto,
    tasksById?: Map<string, TaskResponseDto>
  ): Promise<TaskResponseDto | null> {
    if ("inputRequests" in task && "dependsOnIds" in task) {
      return task as TaskResponseDto;
    }

    const cached = tasksById?.get(task.id);
    if (cached) {
      return cached;
    }

    try {
      return await this.client.getTask(task.id);
    } catch (error) {
      console.error("Failed to hydrate task", error);
      return null;
    }
  }

  private async hasPendingDependencies(
    task: TaskResponseDto,
    tasksById?: Map<string, TaskResponseDto>
  ): Promise<boolean> {
    const dependencies = task.dependsOnIds ?? [];
    if (dependencies.length === 0) {
      return false;
    }

    for (const dependencyId of dependencies) {
      const dependency = tasksById?.get(dependencyId) ?? await this.client.getTask(dependencyId);
      if (!dependency || dependency.status !== "DONE") {
        return true;
      }
    }

    return false;
  }

  private async resolveRepoUrl(task: TaskResponseDto | TaskWirePayload): Promise<string | null> {
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

    return repoUrl;
  }
}
