import { setTimeout as sleep } from 'timers/promises';
import { ApiClient } from '@taico/client/v2';
import { WorkerAuth } from './auth/worker-auth.js';
import { runTaskClaimWorker, attemptClaimTask } from './task-claim-worker.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';

// Global map to track active execution abort controllers
export const activeExecutionAbortControllers = new Map<string, AbortController>();
export const activeExecutionInterruptHandlers = new Map<string, () => void | Promise<void>>();

const STARTUP_RETRY_DELAY_MS = 2_000;
const DEFAULT_WORKER_SHUTDOWN_GRACE_MS = 60_000;
const WORKER_SHUTDOWN_MESSAGE = 'Worker shutdown interrupted active execution.';

export type WorkerOptions = {
  serverUrl: string;
  credentialsPath?: string;
  workingDirectory: string;
  shutdownGraceMs?: number;
};

type WorkerBootstrapResult = Awaited<
  ReturnType<WorkerAuth['ensureAuthenticated']>
>;

export async function startWorkerApp(options: WorkerOptions): Promise<void> {
  const startupAbortController = new AbortController();
  const shutdownCoordinator = new WorkerShutdownCoordinator({
    graceMs: options.shutdownGraceMs ?? readShutdownGraceMs(),
  });
  const removeSignalHandlers = installSignalHandlers((signal) => {
    startupAbortController.abort();
    shutdownCoordinator.beginShutdown(signal);
  });

  const auth = new WorkerAuth({
    serverUrl: options.serverUrl,
    credentialsPath: options.credentialsPath,
  });

  console.log(`[worker] Starting worker mode against ${auth.serverUrl}`);
  console.log(
    `[worker] Using working directory ${options.workingDirectory}`,
  );

  let bootstrap: WorkerBootstrapResult;
  try {
    bootstrap = await ensureAuthenticatedWithRetry(auth, startupAbortController.signal);
  } catch (error) {
    removeSignalHandlers();
    if (error instanceof WorkerStartupCanceledError) {
      console.log('[worker] Startup canceled.');
      return;
    }
    throw error;
  }

  if (shutdownCoordinator.isShuttingDown()) {
    removeSignalHandlers();
    return;
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

  const activityGatewayClient = new ExecutionActivityGatewayClient({
    baseUrl: auth.serverUrl,
    auth,
    debug: true,
    onTaskQueued: (event) => {
      void attemptClaimTask(
        event.taskId,
        client,
        options.workingDirectory,
        auth.serverUrl,
        activityGatewayClient,
        shutdownCoordinator.getTaskClaimOptions(),
      );
    },
    onExecutionInterruptRequest: (event) => {
      console.log(`[worker] Received interrupt request for execution ${event.executionId}`);
      const abortController = activeExecutionAbortControllers.get(event.executionId);
      if (abortController) {
        console.log(`[worker] Aborting execution ${event.executionId}`);
        abortController.abort();
        void Promise.resolve(activeExecutionInterruptHandlers.get(event.executionId)?.()).catch((error) => {
          console.warn(
            `[worker] Failed to interrupt execution ${event.executionId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      } else {
        console.warn(`[worker] No active execution found for ${event.executionId}`);
      }
    },
  });

  try {
    await activityGatewayClient.start();

    if (shutdownCoordinator.isShuttingDown()) {
      await shutdownCoordinator.shutdown(activityGatewayClient, client);
      return;
    }

    console.log('[worker] Connectivity check succeeded.');

    const taskClaimWorker = runTaskClaimWorker(
      client,
      options.workingDirectory,
      auth.serverUrl,
      activityGatewayClient,
      shutdownCoordinator.getTaskClaimOptions(),
    );

    await Promise.race([
      taskClaimWorker,
      shutdownCoordinator.waitForShutdownStart(),
    ]);

    if (shutdownCoordinator.isShuttingDown()) {
      await shutdownCoordinator.shutdown(activityGatewayClient, client);
      await taskClaimWorker;
    } else {
      await taskClaimWorker;
    }
  } finally {
    removeSignalHandlers();
  }
}

async function ensureAuthenticatedWithRetry(auth: WorkerAuth, signal?: AbortSignal): Promise<{
  credentials: Awaited<ReturnType<WorkerAuth['getCredentials']>>;
  didBootstrap: boolean;
}> {
  let attempt = 1;

  while (true) {
    if (signal?.aborted) {
      throw new WorkerStartupCanceledError();
    }

    try {
      clearRetryStatusLine();
      return await auth.ensureAuthenticated();
    } catch (error) {
      if (!isRetryableStartupError(error)) {
        clearRetryStatusLine();
        throw error;
      }

      renderRetryStatus(attempt);
      const canceled = await waitForRetryOrCancel(STARTUP_RETRY_DELAY_MS, signal);
      clearRetryStatusLine();

      if (canceled || signal?.aborted) {
        throw new WorkerStartupCanceledError();
      }

      attempt += 1;
    }
  }
}

function renderRetryStatus(attempt: number): void {
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

async function waitForRetryOrCancel(delayMs: number, signal?: AbortSignal): Promise<boolean> {
  if (!canCaptureEscapeKey()) {
    try {
      await sleep(delayMs, undefined, { signal });
    } catch (error) {
      if (isAbortError(error)) {
        return true;
      }
      throw error;
    }
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

    const onAbort = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      stdin.off('data', onData);
      stdin.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
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
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function canCaptureEscapeKey(): boolean {
  return Boolean(
    process.stdin.isTTY && typeof process.stdin.setRawMode === 'function',
  );
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
    return [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'UND_ERR_CONNECT_TIMEOUT',
    ].includes(cause.code);
  }

  return false;
}

class WorkerStartupCanceledError extends Error {
  constructor() {
    super('Worker startup canceled by user.');
    this.name = 'WorkerStartupCanceledError';
  }
}

type WorkerSignal = 'SIGTERM' | 'SIGINT';

type WorkerShutdownCoordinatorOptions = {
  graceMs: number;
};

export class WorkerShutdownCoordinator {
  private readonly abortController = new AbortController();
  private readonly activeTaskExecutions = new Set<Promise<void>>();
  private shuttingDown = false;
  private shutdownStartedResolver!: () => void;
  private readonly shutdownStarted = new Promise<void>((resolve) => {
    this.shutdownStartedResolver = resolve;
  });

  constructor(private readonly options: WorkerShutdownCoordinatorOptions) {}

  beginShutdown(signal: WorkerSignal | string): void {
    if (this.shuttingDown) {
      console.log(`[worker] Received ${signal} while shutdown is already in progress.`);
      return;
    }

    this.shuttingDown = true;
    console.log(`[worker] Received ${signal}; starting graceful shutdown.`);
    this.abortController.abort();
    this.shutdownStartedResolver();
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  waitForShutdownStart(): Promise<void> {
    return this.shutdownStarted;
  }

  getTaskClaimOptions() {
    return {
      signal: this.abortController.signal,
      shouldClaimTask: () => !this.shuttingDown,
      trackTaskExecution: (taskId: string, execution: Promise<void>) => {
        this.trackTaskExecution(taskId, execution);
      },
    };
  }

  async shutdown(
    activityGatewayClient: Pick<ExecutionActivityGatewayClient, 'stop'>,
    client?: ApiClient,
  ): Promise<void> {
    if (!this.shuttingDown) {
      this.beginShutdown('shutdown');
    }

    await activityGatewayClient.stop();
    await this.drainOrCancelActiveExecutions(client);
  }

  private trackTaskExecution(taskId: string, execution: Promise<void>): void {
    this.activeTaskExecutions.add(execution);
    void execution.then(
      () => this.activeTaskExecutions.delete(execution),
      () => this.activeTaskExecutions.delete(execution),
    );
    console.log(`[worker] Tracking active execution for task ${taskId}.`);
  }

  private async drainOrCancelActiveExecutions(client?: ApiClient): Promise<void> {
    if (this.activeTaskExecutions.size === 0) {
      console.log('[worker] No active executions to drain.');
      return;
    }

    console.log(
      `[worker] Waiting up to ${this.options.graceMs}ms for ${this.activeTaskExecutions.size} active execution(s) to finish.`,
    );

    const completed = await waitForPromisesToSettle(
      Array.from(this.activeTaskExecutions),
      this.options.graceMs,
    );

    if (completed) {
      console.log('[worker] Active executions drained cleanly.');
      return;
    }

    const executionIds = Array.from(activeExecutionAbortControllers.keys());
    console.warn(
      `[worker] Shutdown grace elapsed; interrupting active execution(s): ${executionIds.join(', ') || 'unknown'}.`,
    );

    await Promise.allSettled(
      executionIds.map(async (executionId) => {
        activeExecutionAbortControllers.get(executionId)?.abort();
        await Promise.resolve(activeExecutionInterruptHandlers.get(executionId)?.());
        await this.markExecutionInterrupted(client, executionId);
      }),
    );
  }

  private async markExecutionInterrupted(client: ApiClient | undefined, executionId: string): Promise<void> {
    if (!client) {
      return;
    }

    try {
      await client.executions.ActiveTaskExecutionController_stopTaskExecution({
        executionId,
        body: {
          status: 'CANCELLED',
          errorCode: 'INTERRUPTED',
          errorMessage: WORKER_SHUTDOWN_MESSAGE,
        },
      });
    } catch (error) {
      console.warn(
        `[worker] Failed to mark execution ${executionId} interrupted during shutdown; stale execution pruning remains the backstop: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function installSignalHandlers(onSignal: (signal: WorkerSignal) => void): () => void {
  const handleSigterm = () => onSignal('SIGTERM');
  const handleSigint = () => onSignal('SIGINT');
  process.once('SIGTERM', handleSigterm);
  process.once('SIGINT', handleSigint);

  return () => {
    process.off('SIGTERM', handleSigterm);
    process.off('SIGINT', handleSigint);
  };
}

function readShutdownGraceMs(): number {
  const configured = process.env.WORKER_SHUTDOWN_GRACE_MS;
  if (!configured) {
    return DEFAULT_WORKER_SHUTDOWN_GRACE_MS;
  }

  const parsed = Number(configured);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `[worker] Ignoring invalid WORKER_SHUTDOWN_GRACE_MS=${configured}; using ${DEFAULT_WORKER_SHUTDOWN_GRACE_MS}.`,
    );
    return DEFAULT_WORKER_SHUTDOWN_GRACE_MS;
  }

  return parsed;
}

async function waitForPromisesToSettle(promises: Promise<void>[], timeoutMs: number): Promise<boolean> {
  if (promises.length === 0) {
    return true;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.allSettled(promises).then(() => true),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
