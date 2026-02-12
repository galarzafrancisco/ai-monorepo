// git.ts
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function sh(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || stdout || err.message));
      } else {
        resolve();
      }
    });
  });
}

export async function ensureRepo(repo: string, dir: string) {
  const gitDir = join(dir, ".git");

  if (!existsSync(gitDir)) {
    console.log(`[git] cloning ${repo}`);
    await sh(`git clone ${repo} ${dir}`);
  } else {
    console.log(`[git] repo exists, fetching`);
    await sh(`git -C ${dir} fetch --prune`);
  }
}
