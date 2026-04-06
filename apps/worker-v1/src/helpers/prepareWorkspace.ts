// workspace.ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureRepo } from "./ensureRepo.js";
import { WORK_DIR } from "./config.js";

const BASE_DIR = WORK_DIR;

export async function prepareWorkspace(
  taskId: string,
  agentId: string,
  repoUrl?: string | null,
) {
  console.log(`prepping workspace for agent '${agentId}' to work on task '${taskId}'`);
  let workDir = join(BASE_DIR, taskId, agentId);

  // Ensure base directory exists
  mkdirSync(workDir, { recursive: true });

  // If no repoUrl provided, just return the base workDir
  if (!repoUrl) {
    console.log(`no repo url provided, using base workDir: ${workDir}`);
    return workDir;
  }

  // If repoUrl provided, update workDir to point to the repo path
  workDir = join(workDir, "repo");
  console.log(`using repo: ${repoUrl}`);

  // Ensure repo exists at the workDir location
  await ensureRepo(repoUrl, workDir);

  return workDir;
}
