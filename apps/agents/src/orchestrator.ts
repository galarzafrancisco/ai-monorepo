import { TaskEntity } from "../../backend/src/taskeroo/task.entity";
import { AgentApiClient } from "./api";
import { assignHandler } from "./assignHandler";
import { TaskerooListener } from "./ws";

/*
What triggers a run?
- Task must be assigned
- The assignee must be an agent
- The agent must be configured to trigger on the task status
- For now, to manage throughput, that agent cannot have any other active sessions. How do we check this?
*/

const BASE_URL = process.env.TASKEROO_URL ?? "http://localhost:3000";

const agentApiClient = new AgentApiClient(BASE_URL);

async function processTask(task: TaskEntity) {
  try {

    // Task must be assigned
    if (!task.assignee) {
      console.log(`[⏰] task not assigned. Skip.`)
      return;
    }

    // Assignee must be an agent
    const agent = await agentApiClient.getAgent(task.assignee);
    if (!agent) {
      console.log(`[⏰] didn't find agent '${task.assignee}'. Skip.`);
      return;
    }

    // Agent must react to this task status
    if (!agent.statusTriggers.includes(task.status)) {
      console.log(`[⏰] agent '${task.assignee}' doesn't react to status '${task.status}'. Skip.`);
      return;
    }

    console.log("GET TO WORK MOTHERFUCKER!");
    assignHandler(task.id, agent, "https://github.com/galarzafrancisco/ai-monorepo.git");

  } catch(error) {
    console.error(`Error processing event`, error);
  }
}

// Connects to the backend
const listener = new TaskerooListener(
  BASE_URL,
  (task: TaskEntity) => {
    console.log("🔔 task trigger received");
    processTask(task);
  }
)
