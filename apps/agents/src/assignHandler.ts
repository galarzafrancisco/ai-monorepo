/*
Reacts to a task being assigned

Input:
- task id
- git repo
- agent id
*/

import { getAgentPrompt } from "./agentApi";
import { runAgentStream } from "./claude";
import { printClaudeMessage } from "./messagePrinter";
import { getSession, setSession } from "./sessionStore";
import { prepareWorkspace } from "./workspace";

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

export async function assignHandler(taskId: string, agentId: string, repo: string) {
  // Fetch agent (mock)
  const prompt = await getAgentPrompt(agentId);

  // Load session
  const sessionId = getSession(agentId, taskId);

  const { repoDir } = await prepareWorkspace(taskId, agentId, repo);

  const result = await runAgentStream({
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
    prompt,
    sessionId: sessionId ?? null,
    workDir: repoDir,
  };
}
