// Coordinator.ts
import { TaskWirePayload } from "@taico/events";
import { Taico } from "./Taico.js";
import { ACCESS_TOKEN, AGENT_SLUG, BASE_URL } from "./helpers/config.js";
import { prepareWorkspace } from "./helpers/prepareWorkspace.js";
import { getSession, setSession } from "./helpers/sessionStore.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { SocketIOTasksTransport, TaskEvent } from "./SocketIOTasksTransport.js"
import { BaseAgentRunner } from "./runners/BaseAgentRunner.js";
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";
import { ADKAgentRunner } from "./runners/ADKAgentRunner.js";
import { GitHubCopilotAgentRunner } from "./runners/GitHubCopilotAgentRunner.js";
import { AgentModelConfig } from "./runners/AgentRunner.js";

export class Coordinator {

  private ready: boolean = false;
  private transport: SocketIOTasksTransport;
  private client: Taico;

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

  private async handleTask(task: TaskWirePayload) {
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
      console.log(`- Agent @${actor.slug} of type "${agent.type}" not supported. Skipping. ❌`);
      return;
    }

    try {
      
      const results = await runner.run(
        {
          taskId: task.id,
          prompt: `You got triggered by new activity in task "${task.id}". Fetch the task and proceed according to the following instructions.\n\n\n ${agent.systemPrompt}`,
          cwd: workDir,
          runId: run.id,
        },
        {
          onEvent: (message: string) => {
            console.log(`[agent message] ⤵️`);
            console.log(message);
            console.log('[end of agent message] ⤴️')
            this.transport.publishActivity({
              taskId: task.id,
              message,
              ts: Date.now(),
            });
          },
          onSession: (sessionId: string) => {
            if (!sessionId) {
              setSession(agent.actorId, task.id, sessionId);
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
      )

      console.log(results);
    } catch (error) {
      console.error(`Error running task`);
      console.error(error);
      // Force a comment
      this.client.addComment(task.id, `❌ Something went wrong ❌\n\n${error}`);
    }
  }
}
