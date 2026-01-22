// Coordinator.ts
import { TaskEntity } from "../../backend/src/tasks/task.entity.js";
import { Traff } from "./Traff.js";
import { ACCESS_TOKEN, BASE_URL } from "./helpers/config.js";
import { prepareWorkspace } from "./helpers/prepareWorkspace.js";
import { getSession, setSession } from "./helpers/sessionStore.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { SocketIOTasksTransport, TaskEvent } from "./SocketIOTasksTransport.js"

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
        debug: true,
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
    console.log(evt.type);
    console.log(evt);
    // For now just look at create and assign and status change
    if (evt.type === 'created' || evt.type === 'assigned' || evt.type === 'status_changed') {
      console.log('in')
      const task = evt.task;
      this.handleTask(task);
    }
  }

  private async handleTask(task: TaskEntity) {
    // Get the agent
    const actor = task.assigneeActor;
    if (!actor) {
      console.log(`[⏰] task ${task.id} not assigned. Skipping.`);
      return;
    }
    const agent = await this.client.getAgent(actor.slug);
    if (!agent) {
      console.log(`[⏰] agent @${actor.slug} not found. Skipping.`);
      return;
    }

    // Do we have runners for this agent?
    if (agent.type !== "claude") {
      console.log(`[⏰] agent @${actor.slug} of type "${agent.type}" not supported. Skipping.`);
      return;
    }

    // Does the agent respond to this status?
    if (!agent.statusTriggers.includes(task.status)) {
      console.log(`[⏰] agent '${task.assigneeActorId}' doesn't react to status '${task.status}'. Skip.`);
      return;
    }

    // Load session
    const sessionId = getSession(agent.actorId, task.id);

    // Prep workspace
    const { repoDir } = await prepareWorkspace(task.id, agent.actorId)

    // Create agent runner
    const runner = new ClaudeAgentRunner()

    try {
      const results = await runner.run(
        {
          taskId: task.id,
          prompt: `You got triggered by new activity in task "${task.id}". Fetch the task and proceed according to the following instructions.\n\n\n ${agent.systemPrompt}`,
          cwd: repoDir,
        },
        {
          onEvent: (message: string) => {
            console.log(`Message`);
            console.log(message);
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
            console.log('Claude error detected');
            console.log('error message:', error.message);
            console.log('raw message', error.rawMessage);

            // Post error to task as a comment
            this.client.addComment(
              task.id,
              `⚠️ Claude Error Detected ⚠️\n\n${error.message}\n\n\`\`\`json\nraw message\n${JSON.stringify(error.rawMessage, null, 2)}\n\`\`\``
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

