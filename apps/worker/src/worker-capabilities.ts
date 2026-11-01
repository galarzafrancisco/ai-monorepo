import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { WorkerCapabilities } from '@taico/events';

function run(command: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok, stdout });
    };
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(false);
    }, 3_000);
  });
}

async function claudeAuthenticated(): Promise<boolean> {
  if (process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return true;

  const status = await run('claude', ['auth', 'status', '--json']);
  if (status.ok) {
    try {
      return JSON.parse(status.stdout).loggedIn === true;
    } catch {
      // Older CLI versions may not support JSON output; check the stored OAuth token below.
    }
  }

  try {
    const credentials = JSON.parse(await readFile(join(homedir(), '.claude', '.credentials.json'), 'utf8'));
    const oauth = credentials.claudeAiOauth;
    return typeof oauth?.accessToken === 'string' && oauth.accessToken.length > 0 &&
      (typeof oauth.expiresAt !== 'number' || oauth.expiresAt > Date.now());
  } catch {
    return false;
  }
}

export async function detectWorkerCapabilities(): Promise<WorkerCapabilities> {
  const [opencode, claudeAuthenticatedStatus, git, gh] = await Promise.all([
    run('opencode', ['--version']),
    claudeAuthenticated(),
    run('git', ['--version']),
    run('gh', ['--version']),
  ]);
  return {
    os: process.platform,
    architecture: process.arch,
    opencode: opencode.ok,
    claudeAuthenticated: claudeAuthenticatedStatus,
    git: git.ok,
    gh: gh.ok,
  };
}
