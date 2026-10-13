import { setTimeout as sleep } from 'timers/promises';
import { ApiClient } from '@taico/client/v2';
import { pickTask } from './task-picker.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';
import { isTaskClaimDeferred } from './task-claim-deferral.js';

const QUEUE_POLL_INTERVAL_MS = 60_000;

type PickTaskFn = typeof pickTask;

export type TaskClaimWorkerOptions = {
  signal?: AbortSignal;
  shouldClaimTask?: () => boolean;
  trackTaskExecution?: (taskId: string, execution: Promise<void>) => void;
  pollIntervalMs?: number;
  pickTaskFn?: PickTaskFn;
};

export async function runTaskClaimWorker(
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
  activityGatewayClient: ExecutionActivityGatewayClient,
  options: TaskClaimWorkerOptions = {},
): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? QUEUE_POLL_INTERVAL_MS;
  console.log(
    `[worker] Polling executions queue every ${pollIntervalMs / 1000}s.`,
  );

  while (!options.signal?.aborted) {
    try {
      await processNextQueuedTask(
        client,
        workingDirectory,
        baseUrl,
        activityGatewayClient,
        options,
      );
    } catch (error) {
      if (isAbortError(error)) {
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Queue poll failed: ${message}`);
    }

    try {
      await sleep(pollIntervalMs, undefined, { signal: options.signal });
    } catch (error) {
      if (isAbortError(error)) {
        break;
      }
      throw error;
    }
  }

  console.log('[worker] Task claim worker stopped.');
}

export async function attemptClaimTask(
  taskId: string,
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
  activityGatewayClient: ExecutionActivityGatewayClient,
  options: TaskClaimWorkerOptions = {},
): Promise<void> {
  console.log(`[worker] Received queue notification for task ${taskId}, attempting to claim...`);

  if (!canClaimTask(options)) {
    console.log(`[worker] Skipping task ${taskId}; worker is shutting down.`);
    return;
  }

  if (isTaskClaimDeferred(taskId)) {
    console.log(`[worker] Skipping task ${taskId}; recently unclaimed by this worker.`);
    return;
  }

  try {
    const taskExecution = (options.pickTaskFn ?? pickTask)({
      client,
      taskId,
      baseDir: workingDirectory,
      baseUrl,
      activityGatewayClient,
    });
    options.trackTaskExecution?.(taskId, taskExecution);
    await taskExecution;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[worker] Failed to claim task ${taskId}: ${message}`);
  }
}

async function processNextQueuedTask(
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
  activityGatewayClient: ExecutionActivityGatewayClient,
  options: TaskClaimWorkerOptions,
): Promise<void> {
  if (!canClaimTask(options)) {
    return;
  }

  const queueResponse = await client.executions.TaskExecutionQueueController_listQueue({ limit: 25 });
  console.log(`[worker] Queue poll succeeded. ${queueResponse.total} task(s) ready.`);

  if (!canClaimTask(options)) {
    return;
  }

  const nextTask = queueResponse.items.find(
    (item) => !isTaskClaimDeferred(item.taskId),
  );
  if (!nextTask) {
    return;
  }

  if (!canClaimTask(options)) {
    return;
  }

  const taskExecution = (options.pickTaskFn ?? pickTask)({
    client,
    taskId: nextTask.taskId,
    baseDir: workingDirectory,
    baseUrl,
    activityGatewayClient,
  })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[worker] Task processing failed for ${nextTask.taskId}: ${message}`,
      );
    });

  options.trackTaskExecution?.(nextTask.taskId, taskExecution);
}

function canClaimTask(options: TaskClaimWorkerOptions): boolean {
  return !options.signal?.aborted && (options.shouldClaimTask?.() ?? true);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
