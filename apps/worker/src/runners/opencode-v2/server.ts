import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer, type AddressInfo } from 'node:net';
import { createOpencodeClient, type Config, type OpencodeClient } from '@opencode-ai/sdk/v2';
import { killProcessTree } from './process-tree.js';
import {
  assertServerVersion,
  checkOpencodeCli,
  OPENCODE_PINNED_VERSION,
  OpencodeVersionMismatchError,
  resolveOpencodeBin,
} from './version.js';

export type OpencodeV2ServerOptions = {
  /** Directory the server process starts in. Also the client's default `directory`. */
  cwd: string;
  /** Full OpenCode config for this execution (passed via OPENCODE_CONFIG_CONTENT). */
  config: Config;
  /** `opencode` binary; defaults to TAICO_OPENCODE_BIN or `opencode` on PATH. */
  bin?: string;
  /**
   * Fixed port. When omitted, a free ephemeral port is reserved per attempt
   * (NOT `--port 0`: OpenCode then always tries 4096 first, so back-to-back
   * servers reuse the same port and pooled keep-alive sockets hit the dead
   * predecessor with ECONNRESET).
   */
  port?: number;
  /** Upper bound for spawn → listening → healthy. */
  startupTimeoutMs?: number;
  /** Aborting during startup kills the process tree and rejects. */
  signal?: AbortSignal;
  /** Extra env (tests use this to isolate HOME/XDG dirs). */
  env?: NodeJS.ProcessEnv;
  /** Expected server version (defaults to the pinned version). */
  expectedVersion?: string;
  /** Custom fetch for the client (tests use it to inject SSE faults). */
  fetch?: typeof fetch;
};

export type OpencodeV2Server = {
  url: string;
  pid: number;
  version: string;
  client: OpencodeClient;
  /** Kills the full process tree; resolves once every process is gone. Idempotent. */
  stop(): Promise<void>;
  /** Resolves when the server process exits for any reason. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
};

export class OpencodeStartupError extends Error {
  constructor(message: string, readonly output: string, readonly exitedEarly = false) {
    super(output.trim() ? `${message}\n${output.trim().slice(-2_000)}` : message);
    this.name = 'OpencodeStartupError';
  }
}

export class OpencodeStartupAbortedError extends Error {
  constructor() {
    super('OpenCode server startup was aborted');
    this.name = 'OpencodeStartupAbortedError';
  }
}

const LISTENING_RE = /opencode server listening on\s+(https?:\/\/\S+)/;

/**
 * Starts one dedicated, loopback-only, password-protected `opencode serve`
 * for a single Taico execution and returns a v2 client bound to `cwd`.
 *
 * - No `process.chdir`: the child is spawned with `cwd` and the client sends
 *   the directory with every request.
 * - Detached process group + tree snapshot kill, so tool shells and local MCP
 *   servers do not outlive the execution.
 * - CLI preflight: `<bin> --version` must equal the pinned version before any
 *   `serve` process is spawned (mismatch → OpencodeVersionMismatchError).
 * - Startup is bounded by `startupTimeoutMs`, including the CLI preflight and
 *   the server health/version check.
 */
export async function startOpencodeV2Server(options: OpencodeV2ServerOptions): Promise<OpencodeV2Server> {
  const deadline = Date.now() + (options.startupTimeoutMs ?? 30_000);
  const bin = resolveOpencodeBin(options.bin);
  const expected = options.expectedVersion ?? OPENCODE_PINNED_VERSION;

  if (options.signal?.aborted) {
    throw new OpencodeStartupAbortedError();
  }

  // CLI preflight: refuse to start a server from a binary that is not the
  // pinned version. Runs before any `serve` process exists and counts toward
  // the startup deadline.
  await preflightCli(bin, expected, deadline - Date.now(), options.signal);

  if (options.port !== undefined) {
    return startOnce({ ...options, bin, startupTimeoutMs: Math.max(1, deadline - Date.now()) }, options.port);
  }
  // A reserved port can be grabbed by someone else before OpenCode binds it.
  // OpenCode only reports an opaque "ServeError" then, so retry early exits a few times.
  let lastError: unknown = new OpencodeStartupError('OpenCode server startup deadline exceeded after CLI preflight', '');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      return await startOnce({ ...options, bin, startupTimeoutMs: remaining }, await reserveFreePort());
    } catch (error) {
      lastError = error;
      if (!(error instanceof OpencodeStartupError) || !error.exitedEarly) throw error;
    }
  }
  throw lastError;
}

async function preflightCli(bin: string, expected: string, budgetMs: number, signal?: AbortSignal): Promise<void> {
  if (budgetMs <= 0) {
    throw new OpencodeStartupError('OpenCode startup deadline exceeded before CLI preflight', '');
  }
  try {
    await checkOpencodeCli({ bin, expected, timeoutMs: Math.min(10_000, budgetMs), signal });
  } catch (error) {
    if (error instanceof OpencodeVersionMismatchError) throw error;
    if (signal?.aborted) throw new OpencodeStartupAbortedError();
    const err = error as NodeJS.ErrnoException & { killed?: boolean; stderr?: string };
    const reason = err.killed ? 'timed out' : `failed: ${err.message}`;
    throw new OpencodeStartupError(`OpenCode CLI preflight (\`${bin} --version\`) ${reason}`, err.stderr ?? '');
  }
}

function reserveFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function startOnce(options: OpencodeV2ServerOptions, port: number): Promise<OpencodeV2Server> {
  const {
    cwd,
    config,
    startupTimeoutMs = 30_000,
    signal,
    env,
    expectedVersion = OPENCODE_PINNED_VERSION,
  } = options;
  const bin = resolveOpencodeBin(options.bin);

  if (signal?.aborted) {
    throw new OpencodeStartupAbortedError();
  }

  const startedAt = Date.now();
  const password = randomBytes(24).toString('base64url');
  const proc: ChildProcessWithoutNullStreams = spawn(
    bin,
    ['serve', '--hostname=127.0.0.1', `--port=${port}`],
    {
      cwd,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        ...env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
        OPENCODE_SERVER_PASSWORD: password,
        OPENCODE_SERVER_USERNAME: 'opencode',
        OPENCODE_DISABLE_AUTOUPDATE: '1',
      },
    },
  );

  let output = '';
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    proc.once('exit', (code, sig) => resolve({ code, signal: sig }));
    proc.once('error', () => resolve({ code: null, signal: null }));
  });

  let stopPromise: Promise<void> | undefined;
  const stop = () => {
    stopPromise ??= (async () => {
      if (proc.pid) {
        const survivors = await killProcessTree(proc.pid);
        if (survivors.length > 0) {
          console.warn(`[opencode-v2] processes survived SIGKILL: ${survivors.join(', ')}`);
        }
      }
      await Promise.race([exited, new Promise((r) => setTimeout(r, 2_000))]);
    })();
    return stopPromise;
  };

  const collect = (chunk: Buffer) => {
    output += chunk.toString();
    if (output.length > 20_000) {
      output = output.slice(-20_000);
    }
  };
  proc.stdout.on('data', collect);
  proc.stderr.on('data', collect);

  let cleanupAbort = () => {};
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new OpencodeStartupError(`OpenCode server did not start within ${startupTimeoutMs}ms`, output)),
        startupTimeoutMs,
      );
      const onAbort = () => reject(new OpencodeStartupAbortedError());
      signal?.addEventListener('abort', onAbort, { once: true });
      cleanupAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      const onData = () => {
        const match = output.match(LISTENING_RE);
        if (match) {
          proc.stdout.off('data', onData);
          resolve(match[1]);
        }
      };
      proc.stdout.on('data', onData);
      proc.once('error', (error) => reject(new OpencodeStartupError(`Failed to spawn ${bin}: ${error.message}`, output)));
      void exited.then(({ code, signal: sig }) =>
        reject(new OpencodeStartupError(`OpenCode server exited during startup (code=${code}, signal=${sig})`, output, true)),
      );
    });

    const client = createOpencodeClient({
      baseUrl: url,
      directory: cwd,
      headers: {
        authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`,
      },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });

    const remaining = () => Math.max(1, startupTimeoutMs - (Date.now() - startedAt));
    // "listening" is printed before the instance finishes booting; poll health
    // until it answers (still within the overall startup deadline).
    let version: string | undefined;
    let lastProblem = 'no response';
    while (version === undefined) {
      const health = await withTimeout(client.global.health(), remaining(), 'OpenCode health check timed out', signal);
      if (health.data?.healthy) {
        version = assertServerVersion(health.data, expectedVersion);
        break;
      }
      lastProblem = `status ${health.response?.status ?? 'n/a'}`;
      if (remaining() <= 100) {
        throw new OpencodeStartupError(`OpenCode server never became healthy (${lastProblem})`, output);
      }
      await withTimeout(new Promise((r) => setTimeout(r, 100)), remaining(), 'OpenCode health check timed out', signal);
    }
    cleanupAbort();

    return { url, pid: proc.pid!, version, client, stop, exited };
  } catch (error) {
    cleanupAbort();
    await stop();
    throw error;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string, signal?: AbortSignal): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
        onAbort = () => reject(new OpencodeStartupAbortedError());
        if (signal?.aborted) onAbort();
        signal?.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}
