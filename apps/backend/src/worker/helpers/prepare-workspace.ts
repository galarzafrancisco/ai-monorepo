import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { ensureRepo } from './ensure-repo';

const WORKSPACE_BASE_DIR = process.env.TAICO_WORK_DIR
  ? process.env.TAICO_WORK_DIR
  : join(os.homedir(), '.taico', 'workspaces');

export async function prepareWorkspace(
  taskId: string,
  agentActorId: string,
  repoUrl?: string | null,
): Promise<string> {
  let workspaceDir = join(WORKSPACE_BASE_DIR, taskId, agentActorId);
  mkdirSync(workspaceDir, { recursive: true });

  if (!repoUrl) {
    return workspaceDir;
  }

  workspaceDir = join(workspaceDir, 'repo');
  await ensureRepo(repoUrl, workspaceDir);
  return workspaceDir;
}
