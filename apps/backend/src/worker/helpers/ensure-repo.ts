import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

function runGit(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `git exited with code ${code ?? -1}`));
    });
  });
}

export async function ensureRepo(repoUrl: string, targetDir: string): Promise<void> {
  const gitDir = join(targetDir, '.git');
  mkdirSync(dirname(targetDir), { recursive: true });

  if (!existsSync(gitDir)) {
    console.log(`[worker] cloning repo ${repoUrl}`);
    await runGit(['clone', repoUrl, targetDir]);
    return;
  }

  console.log(`[worker] fetching latest changes in ${targetDir}`);
  await runGit(['-C', targetDir, 'fetch', '--prune']);
}
