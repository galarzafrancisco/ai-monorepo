// workspace.ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureRepo } from "./git";

const BASE_DIR =
  "/Users/franciscogalarza/github/ai-monorepo/apps/agents/temp"; // TODO: temporary hard code

export async function prepareWorkspace(
  taskId: string,
  agentId: string,
  repo: string
) {
  console.log(`prepping workspace for agent '${agentId}' to work on task '${taskId}'`);
  const workDir = join(BASE_DIR, taskId, agentId);
  const repoDir = join(workDir, "repo");

  // Ensure directories exist
  mkdirSync(workDir, { recursive: true });

  // Ensure repo exists inside workspace
  await ensureRepo(repo, repoDir);

  return {
    workDir,
    repoDir,
  };
}
