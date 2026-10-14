import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { Config, PermissionConfig, PermissionRequest } from '@opencode-ai/sdk/v2';
import type { RuntimeMcpServerConfig } from '../AgentRunner.js';

export type PolicyAction = 'allow' | 'deny' | 'ask';
export type PolicyRule = PolicyAction | Record<string, PolicyAction>;

/**
 * Taico's explicit OpenCode tool policy. Nothing is left to OpenCode defaults:
 * the result is passed as the full `permission` config of the dedicated server.
 *
 * Keys are OpenCode permission names: built-ins (`bash`, `edit`, `read`,
 * `webfetch`, …), `external_directory`, and MCP tools as `<server>_<tool>`
 * (globs allowed, e.g. `tasks_*`).
 */
export type TaicoOpencodePolicy = {
  /** Applied to anything not matched below. */
  default: PolicyAction;
  rules: Record<string, PolicyRule>;
};

/**
 * Default for headless worker runs:
 * - workspace tools allowed (that is what the agent is for),
 * - leaving the workspace is denied,
 * - interactive `question` is denied (no human attached; it would block).
 *
 * NOTE: this is policy, not isolation. Shell commands still run with worker
 * privileges; see the rollout notes in docs/how-to-guides/opencode-v2-runner.md.
 */
export const DEFAULT_TAICO_OPENCODE_POLICY: TaicoOpencodePolicy = {
  default: 'allow',
  rules: {
    external_directory: 'deny',
    question: 'deny',
    doom_loop: 'deny',
  },
};

export function toOpencodePermission(policy: TaicoOpencodePolicy): PermissionConfig {
  // Order matters to OpenCode (last match wins), so the catch-all goes first.
  return { '*': policy.default, ...policy.rules } as PermissionConfig;
}

/** Decides a `permission.asked` request. Must resolve; it is raced against a timeout. */
export type PermissionApprover = (request: PermissionRequest) => Promise<'once' | 'reject'> | 'once' | 'reject';

/** Headless default: nobody can answer, so every `ask` becomes a rejection. */
export const rejectAllApprover: PermissionApprover = () => 'reject';

type OpencodeMcpConfig = NonNullable<Config['mcp']>[string];

export function toOpencodeMcp(servers: Record<string, RuntimeMcpServerConfig>): Record<string, OpencodeMcpConfig> {
  const out: Record<string, OpencodeMcpConfig> = {};
  for (const [id, server] of Object.entries(servers)) {
    out[id] =
      server.type === 'http'
        ? // oauth:false — Taico supplies bearer headers; never start an interactive OAuth flow.
          { type: 'remote', url: server.url, headers: server.headers, enabled: true, oauth: false }
        : { type: 'local', command: [server.command, ...server.args], enabled: true };
  }
  return out;
}

export function buildOpencodeConfig({
  mcp,
  policy,
  extra,
}: {
  mcp: Record<string, RuntimeMcpServerConfig>;
  policy: TaicoOpencodePolicy;
  extra?: Config;
}): Config {
  return {
    ...extra,
    autoupdate: false,
    share: 'disabled',
    mcp: toOpencodeMcp(mcp),
    permission: toOpencodePermission(policy),
  };
}

export class WorkspaceBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceBoundaryError';
  }
}

/**
 * Resolve the execution directory and make sure it is inside the worker's
 * workspace root after following symlinks. Returns the canonical cwd that the
 * server must be started in.
 */
export function resolveExecutionBoundary(cwd: string, workspaceRoot?: string): string {
  if (!isAbsolute(cwd)) {
    throw new WorkspaceBoundaryError(`Execution cwd must be absolute: ${cwd}`);
  }
  const real = realpathSync(resolve(cwd));
  if (workspaceRoot) {
    const root = realpathSync(resolve(workspaceRoot));
    const rel = relative(root, real);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      throw new WorkspaceBoundaryError(`Execution cwd ${real} is not inside workspace root ${root}`);
    }
  }
  return real;
}
