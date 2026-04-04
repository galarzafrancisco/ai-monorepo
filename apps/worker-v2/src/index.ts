#!/usr/bin/env node

import { setTimeout as sleep } from 'timers/promises';
import { ApiClient } from '@taico/client/v2';
import { WorkerAuth } from './auth/worker-auth.js';

const QUEUE_POLL_INTERVAL_MS = 60_000;
const STARTUP_RETRY_DELAY_MS = 2_000;

type WorkerOptions = {
  serverUrl: string;
  credentialsPath?: string;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    printUsage();
    return;
  }

  const serverUrl = readCliOption(args, '--serverurl');
  if (!serverUrl) {
    throw new Error('Missing required --serverurl');
  }

  const credentialsPath = readCliOption(args, '--credentials-path') ?? undefined;

  await runWorker({
    serverUrl,
    credentialsPath,
  });
}

export async function runWorker(options: WorkerOptions): Promise<void> {
  const auth = new WorkerAuth({
    serverUrl: options.serverUrl,
    credentialsPath: options.credentialsPath,
  });

  console.log(`[worker] Starting worker mode against ${auth.serverUrl}`);

  let bootstrap;
  try {
    bootstrap = await ensureAuthenticatedWithRetry(auth);
  } catch (error) {
    if (error instanceof WorkerStartupCanceledError) {
      console.log('[worker] Startup canceled.');
      return;
    }
    throw error;
  }

  if (bootstrap.didBootstrap) {
    console.log(
      `[worker] Stored credentials at ${auth.getCredentialsPath()}`,
    );
  }

  const client = new ApiClient({
    baseUrl: auth.serverUrl,
    getAccessToken: () => auth.getAccessToken(),
  });

  console.log('[worker] Connectivity check succeeded.');
  console.log(
    `[worker] Polling executions-v2 queue every ${QUEUE_POLL_INTERVAL_MS / 1000}s.`,
  );

  while (true) {
    try {
      const queue =
        await client.executionsV2.TaskExecutionQueueController_listQueue();
      console.log(
        `[worker] Queue poll succeeded. ${queue.length} task(s) ready.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Queue poll failed: ${message}`);
    }

    await sleep(QUEUE_POLL_INTERVAL_MS);
  }
}

async function ensureAuthenticatedWithRetry(auth: WorkerAuth): Promise<{
  credentials: Awaited<ReturnType<WorkerAuth['getCredentials']>>;
  didBootstrap: boolean;
}> {
  let attempt = 1;

  while (true) {
    try {
      clearRetryStatusLine();
      return await auth.ensureAuthenticated();
    } catch (error) {
      if (!isRetryableStartupError(error)) {
        clearRetryStatusLine();
        throw error;
      }

      renderRetryStatus(attempt, error);
      const canceled = await waitForRetryOrCancel(STARTUP_RETRY_DELAY_MS);
      clearRetryStatusLine();

      if (canceled) {
        throw new WorkerStartupCanceledError();
      }

      attempt += 1;
    }
  }
}

function renderRetryStatus(attempt: number, error: unknown): void {
  const cancelHint = canCaptureEscapeKey()
    ? 'Press Esc to cancel or Ctrl+C to exit.'
    : 'Press Ctrl+C to exit.';

  process.stdout.write(
    `\r\x1b[2K[worker] Taico Server is not responding. Retrying in ${STARTUP_RETRY_DELAY_MS / 1000}s. Failed ${attempt} time${attempt === 1 ? '' : 's'}. ${cancelHint}`,
  );
}

function clearRetryStatusLine(): void {
  process.stdout.write('\r\x1b[2K');
}

async function waitForRetryOrCancel(delayMs: number): Promise<boolean> {
  if (!canCaptureEscapeKey()) {
    await sleep(delayMs);
    return false;
  }

  const stdin = process.stdin;

  return new Promise<boolean>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, delayMs);

    const onData = (data: Buffer) => {
      if (data.includes(0x1b)) {
        cleanup();
        resolve(true);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      stdin.off('data', onData);
      stdin.off('error', onError);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };

    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.on('data', onData);
    stdin.on('error', onError);
  });
}

function canCaptureEscapeKey(): boolean {
  return Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function');
}

function isRetryableStartupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === 'fetch failed') {
    return true;
  }

  const cause = error.cause;
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    typeof cause.code === 'string'
  ) {
    return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(
      cause.code,
    );
  }

  return false;
}

class WorkerStartupCanceledError extends Error {
  constructor() {
    super('Worker startup canceled by user.');
    this.name = 'WorkerStartupCanceledError';
  }
}

function printUsage(): void {
  console.log(`taico-worker-v2 usage:

  taico-worker-v2 --serverurl <url> [--credentials-path <path>]
    Start worker mode against an existing Taico server.
`);
}

function readCliOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

void main();
