import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * The OpenCode CLI version the v2 runner is validated against.
 *
 * Must match the exact `@opencode-ai/sdk` version pinned in
 * `apps/worker/package.json`. The parity test suite was run against this pair;
 * bumping either side requires re-running `npm run test:opencode-v2 -w @taico/worker`.
 */
export const OPENCODE_PINNED_VERSION = '1.19.0';

/** Env var that overrides which `opencode` binary the v2 runner launches. */
export const OPENCODE_BIN_ENV = 'TAICO_OPENCODE_BIN';

export function resolveOpencodeBin(explicit?: string): string {
  return explicit ?? process.env[OPENCODE_BIN_ENV] ?? 'opencode';
}

export class OpencodeVersionMismatchError extends Error {
  constructor(
    readonly source: 'cli' | 'server',
    readonly actual: string,
    readonly expected: string,
  ) {
    super(
      `OpenCode ${source} version ${actual} does not match the pinned version ${expected}. ` +
        `Install opencode-ai@${expected} or point ${OPENCODE_BIN_ENV} at a matching binary.`,
    );
    this.name = 'OpencodeVersionMismatchError';
  }
}

export type OpencodeCliCheck = {
  bin: string;
  version: string;
};

/**
 * Preflight: run `<bin> --version` and require the pinned version.
 * Bounded by `timeoutMs` so a broken binary cannot stall a claim.
 */
export async function checkOpencodeCli({
  bin = resolveOpencodeBin(),
  expected = OPENCODE_PINNED_VERSION,
  timeoutMs = 10_000,
  signal,
}: {
  bin?: string;
  expected?: string;
  timeoutMs?: number;
  /** Aborting kills the `--version` child and rejects with an AbortError. */
  signal?: AbortSignal;
} = {}): Promise<OpencodeCliCheck> {
  const { stdout } = await execFileAsync(bin, ['--version'], { timeout: timeoutMs, signal });
  const version = stdout.trim();
  if (version !== expected) {
    throw new OpencodeVersionMismatchError('cli', version, expected);
  }
  return { bin, version };
}

export function assertServerVersion(
  health: { healthy?: boolean; version?: string } | undefined,
  expected = OPENCODE_PINNED_VERSION,
): string {
  if (!health?.healthy) {
    throw new Error('OpenCode server reported unhealthy');
  }
  const version = health.version ?? 'unknown';
  if (version !== expected) {
    throw new OpencodeVersionMismatchError('server', version, expected);
  }
  return version;
}
