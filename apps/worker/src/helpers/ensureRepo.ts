import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

type EnsureRepoProps = {
  repo: string;
  dir: string;
}

function git(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // execFile (no shell) so repo URLs / paths are never interpreted by a shell.
    execFile("git", args, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || stdout || err.message));
      } else {
        resolve();
      }
    });
  });
}

export async function ensureRepo({ repo, dir }: EnsureRepoProps) {
  const gitDir = join(dir, ".git");

  if (!existsSync(gitDir)) {
    console.log(`[git] cloning ${repo} into ${dir}`);
    await git(["clone", "--", repo, dir]);
  } else {
    console.log(`[git] repo exists at ${dir}, fetching`);
    await git(["-C", dir, "fetch", "--prune"]);
  }
}
