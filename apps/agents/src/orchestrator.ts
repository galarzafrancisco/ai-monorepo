import 'dotenv/config';
import { TaskEntity } from "../../backend/src/tasks/task.entity";
import { AgentApiClient } from "./api";
import { assignHandler } from "./assignHandler";
import { TasksListener } from "./ws";
import { BASE_URL } from "./config";

/*
What triggers a run?
- Task must be assigned
- The assignee must be an agent
- The agent must be configured to trigger on the task status
- For now, to manage throughput, that agent cannot have any other active sessions. How do we check this?
*/

const agentApiClient = new AgentApiClient(BASE_URL);

async function processTask(task: TaskEntity) {
  try {

    // Task must be assigned
    if (!task.assigneeActorId) {
      console.log(`[⏰] task not assigned. Skip.`)
      return;
    }
    if (!task.assigneeActor) {
      console.log(`[⏰] could not find actor for ${task.assigneeActorId}. Skip.`)
      return;
    }

    // Assignee must be an agent
    const agent = await agentApiClient.getAgent(task.assigneeActor?.slug);
    if (!agent) {
      console.log(`[⏰] didn't find agent '${task.assigneeActorId}'. Skip.`);
      return;
    }

    // Agent must react to this task status
    if (!agent.statusTriggers.includes(task.status)) {
      console.log(`[⏰] agent '${task.assigneeActorId}' doesn't react to status '${task.status}'. Skip.`);
      return;
    }

    console.log("GET TO WORK MOTHERFUCKER!");
    assignHandler(task.id, agent, "https://github.com/galarzafrancisco/ai-monorepo.git");

  } catch(error) {
    console.error(`Error processing event`, error);
  }
}

// Connects to the backend
const listener = new TasksListener(
  BASE_URL,
  (task: TaskEntity) => {
    console.log("🔔 task trigger received");
    processTask(task);
  }
)
