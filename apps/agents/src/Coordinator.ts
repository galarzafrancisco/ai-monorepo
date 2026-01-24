// Coordinator.ts
import { TaskEntity } from "../../backend/src/tasks/task.entity.js";
import { Traff } from "./Traff.js";
import { ACCESS_TOKEN, BASE_URL } from "./helpers/config.js";
import { prepareWorkspace } from "./helpers/prepareWorkspace.js";
import { getSession, setSession } from "./helpers/sessionStore.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { SocketIOTasksTransport, TaskEvent } from "./SocketIOTasksTransport.js"
import { BaseAgentRunner } from "./runners/BaseAgentRunner.js";
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";

export class Coordinator {

  private ready: boolean = false;
  private transport: SocketIOTasksTransport;
  private client: Traff;

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

    this.client = new Traff(BASE_URL, ACCESS_TOKEN);
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
      console.log(`- Task status: ${evt.task.status}`);
      const task = evt.task;
      this.handleTask(task);
    }
  }

  private async handleTask(task: TaskEntity) {
    // Get the agent
    const actor = task.assigneeActor;
    if (!actor) {
      console.log(`- Task ${task.id} not assigned. Skipping. ❌`);
      return;
    }
    const agent = await this.client.getAgent(actor.slug);
    if (!agent) {
      console.log(`- Agent @${actor.slug} not found. Skipping. ❌`);
      return;
    }
    console.log(`- Agent: @${agent.slug}`);

    // Do we have runners for this agent?
    if (agent.type !== "claude" && agent.type !== "opencode") {
      console.log(`- Agent @${actor.slug} of type "${agent.type}" not supported. Skipping. ❌`);
      return;
    }

    // Does the agent respond to this status?
    if (!agent.statusTriggers.includes(task.status)) {
      console.log(`- Agent @${agent.slug} doesn't react to status '${task.status}'. Skip. ❌`);
      return;
    }

    console.log(`- ✅ Conditions met. @${agent.slug} starting to work on task "${task.name}" 🦄`);

    // Load session
    const sessionId = getSession(agent.actorId, task.id);

    // Prep workspace
    const { repoDir } = await prepareWorkspace(task.id, agent.actorId);
    console.log(`- workspace prepped`);

    // Create agent runner
    let runner: BaseAgentRunner | null = null;
    if (agent.type === 'claude') {
      runner = new ClaudeAgentRunner();
    } else if (agent.type === 'opencode') {
      runner = new OpencodeAgentRunner();
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
          cwd: repoDir,
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

      // Force a comment
      this.client.addComment(task.id, `Finished.\n\n${results.result}`);
    } catch (error) {
      console.error(`Error running task`);
      console.error(error);
      // Force a comment
      this.client.addComment(task.id, `❌ Something went wrong ❌\n\n${error}`);
    }
  }
}

