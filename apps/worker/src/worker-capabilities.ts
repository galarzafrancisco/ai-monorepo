import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { WorkerCapabilities } from '@taico/events';

function run(command: string, args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 3_000, windowsHide: true });
  return { ok: !result.error && result.status === 0, stdout: result.stdout || '' };
}

function claudeAuthenticated(): boolean {
  if (process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return true;

  const status = run('claude', ['auth', 'status', '--json']);
  if (status.ok) {
    try {
      return JSON.parse(status.stdout).loggedIn === true;
    } catch {
      // Older CLI versions may not support JSON output; check the stored OAuth token below.
    }
  }

  try {
    const credentials = JSON.parse(readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8'));
    const oauth = credentials.claudeAiOauth;
    return typeof oauth?.accessToken === 'string' && oauth.accessToken.length > 0 &&
      (typeof oauth.expiresAt !== 'number' || oauth.expiresAt > Date.now());
  } catch {
    return false;
  }
}

export function detectWorkerCapabilities(): WorkerCapabilities {
  return {
    os: process.platform,
    architecture: process.arch,
    opencode: run('opencode', ['--version']).ok,
    claudeAuthenticated: claudeAuthenticated(),
    git: run('git', ['--version']).ok,
    gh: run('gh', ['--version']).ok,
  };
}
