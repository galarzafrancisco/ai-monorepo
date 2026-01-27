// workspace.ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureRepo } from "./ensureRepo.js";
import { REPO, WORK_DIR } from "./config.js";

const BASE_DIR = WORK_DIR;

export async function prepareWorkspace(
  taskId: string,
  agentId: string,
  repoUrl?: string | null,
) {
  console.log(`prepping workspace for agent '${agentId}' to work on task '${taskId}'`);
  const workDir = join(BASE_DIR, taskId, agentId);
  const repoDir = join(workDir, "repo");

  // Ensure directories exist
  mkdirSync(workDir, { recursive: true });

  // Use provided repoUrl if available, otherwise fallback to REPO from config
  const targetRepo = repoUrl || REPO;
  console.log(`using repo: ${targetRepo}`);

  // Ensure repo exists inside workspace
  await ensureRepo(targetRepo, repoDir);

  return {
    workDir,
    repoDir,
  };
}
