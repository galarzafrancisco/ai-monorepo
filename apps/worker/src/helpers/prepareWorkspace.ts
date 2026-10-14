import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureRepo as defaultEnsureRepo } from "./ensureRepo.js";
import { ProjectRepo, toRepoDirName } from "./projectRepos.js";

export type PreparedRepo = ProjectRepo & {
  dir: string;
};

export type PreparedWorkspace = {
  /** Directory the agent runs in. */
  cwd: string;
  /** Every repository that was prepared, each in its own folder. */
  repos: PreparedRepo[];
};

type PrepareWorkspaceProps = {
  taskId: string;
  agentId: string;
  baseDir: string;
  repos?: ProjectRepo[];
  ensureRepo?: typeof defaultEnsureRepo;
}

/**
 * Prepare the working directory for an agent run.
 *
 * Layout under `<baseDir>/<taskId>/<agentId>`:
 * - no repos:       cwd is the base directory
 * - one repo:       cloned into `repo/`, which is also the cwd (unchanged legacy layout)
 * - several repos:  each cloned into `repos/<project-slug>/`; cwd is `repos/`
 */
export async function prepareWorkspace({
  taskId,
  agentId,
  baseDir,
  repos = [],
  ensureRepo = defaultEnsureRepo,
}: PrepareWorkspaceProps): Promise<PreparedWorkspace> {
  console.log(`prepping workspace for agent '${agentId}' to work on task '${taskId}'`);
  const baseWorkDir = join(baseDir, taskId, agentId);
  mkdirSync(baseWorkDir, { recursive: true });

  if (repos.length === 0) {
    console.log(`no repo url provided, using base workDir: ${baseWorkDir}`);
    return { cwd: baseWorkDir, repos: [] };
  }

  if (repos.length === 1) {
    const [repo] = repos;
    const dir = join(baseWorkDir, "repo");
    await prepareRepo(ensureRepo, repo, dir);
    return { cwd: dir, repos: [{ ...repo, dir }] };
  }

  const reposRoot = join(baseWorkDir, "repos");
  mkdirSync(reposRoot, { recursive: true });

  const usedDirNames = new Set<string>();
  const planned = repos.map((repo) => {
    const dirName = uniqueDirName(toRepoDirName(repo.slug), usedDirNames);
    return { ...repo, dir: join(reposRoot, dirName) };
  });

  // Clone sequentially: keeps git output readable and avoids hammering the remote.
  for (const repo of planned) {
    await prepareRepo(ensureRepo, repo, repo.dir);
  }

  return { cwd: reposRoot, repos: planned };
}

async function prepareRepo(
  ensureRepo: typeof defaultEnsureRepo,
  repo: ProjectRepo,
  dir: string,
): Promise<void> {
  console.log(`using repo for project '${repo.slug}': ${repo.repoUrl}`);
  try {
    await ensureRepo({ repo: repo.repoUrl, dir });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to prepare repository for project "${repo.slug}" (${repo.repoUrl}): ${reason}`,
      { cause: error },
    );
  }
}

function uniqueDirName(base: string, used: Set<string>): string {
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}-${suffix++}`;
  }
  used.add(name);
  return name;
}
