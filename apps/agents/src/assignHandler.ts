/*
Reacts to a task being assigned

Input:
- task id
- git repo
- agent id
*/

import { AgentResponseDto } from "../../backend/src/agents/dto/agent-response.dto.js";
import { AgentRunArgs, AgentRunResult, runAgentStream as claudeRun } from "./claude.js";
import { runAgentStream as opencodeRun } from "./opencode.js";
import { printClaudeMessage } from "./messagePrinter.js";
import { getSession, setSession } from "./sessionStore.js";
import { prepareWorkspace } from "./workspace.js";

/*
Workflow:
- fetch agent. Output:
  - prompt
- fetch session with agent ID and task ID. It might not exist.

- make temp dir in {BASE}/{TASK_ID}/{AGENT_ID}
- clone repo in the temp dir

Session ID exists?
- Start agent resuming session
- Start agent with new session & store session

*/

export async function assignHandler(taskId: string, agent: AgentResponseDto, repo: string) {

  const { systemPrompt: prompt, slug: agentId } = agent;

  // Load session
  const sessionId = getSession(agentId, taskId);

  const { repoDir } = await prepareWorkspace(taskId, agentId, repo);
  let runner: (AgentRunArgs) => Promise<AgentRunResult>
  if (agent.type === 'claude') {
    runner = claudeRun;
  } else if (agent.type === 'opencode') {
    runner = opencodeRun;
  } else {
    return {
      sessionId: sessionId ?? null,
      workDir: repoDir,
      result: `Agent of type ${agent.type} does not have a runner. Skipping.`,
    }
  }

  const result = await runner({
    taskId,
    prompt,
    cwd: repoDir,
    resume: sessionId ?? undefined,
    persistSession: true,

    // Persist immediately when init arrives
    onSession: async (sid) => {
      if (!sessionId) {
        setSession(agentId, taskId, sid);
      }
    },

    // Optional: stream events to logs / websocket / task updates
    onEvent: printClaudeMessage,
  });

  return {
    sessionId: sessionId ?? null,
    workDir: repoDir,
    result: result.result,
  };
}
