import { setTimeout as sleep } from 'timers/promises';
import type { ApiClient } from '@taico/client/v2';
import type { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';
import { isTaskClaimDeferred } from './task-claim-deferral.js';

const QUEUE_POLL_INTERVAL_MS = 60_000;
const inFlightTaskClaims = new Set<string>();

export async function claimIfNotInFlight(
  taskId: string,
  claimTask: () => Promise<void>,
): Promise<void> {
  if (isTaskClaimDeferred(taskId)) {
    console.log(`[worker] Skipping task ${taskId}; recently unclaimed by this worker.`);
    return;
  }

  if (inFlightTaskClaims.has(taskId)) {
    console.debug(`[worker] Skipping duplicate claim attempt for task ${taskId}; already in flight.`);
    return;
  }

  inFlightTaskClaims.add(taskId);
  try {
    await claimTask();
  } finally {
    inFlightTaskClaims.delete(taskId);
  }
}

export async function runTaskClaimWorker(
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
  activityGatewayClient: ExecutionActivityGatewayClient,
): Promise<void> {
  console.log(
    `[worker] Polling executions queue every ${QUEUE_POLL_INTERVAL_MS / 1000}s.`,
  );

  while (true) {
    try {
      await processNextQueuedTask(
        client,
        workingDirectory,
        baseUrl,
        activityGatewayClient,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Queue poll failed: ${message}`);
    }

    await sleep(QUEUE_POLL_INTERVAL_MS);
  }
}

export async function attemptClaimTask(
  taskId: string,
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
  activityGatewayClient: ExecutionActivityGatewayClient,
): Promise<void> {
  console.log(`[worker] Received queue notification for task ${taskId}, attempting to claim...`);

  try {
    await claimIfNotInFlight(taskId, () =>
      pickQueuedTask({
        client,
        taskId,
        baseDir: workingDirectory,
        baseUrl,
        activityGatewayClient,
      }),
    );
  } catch (error) {
    logClaimFailure(taskId, error);
  }
}

function logClaimFailure(taskId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b(404|409)\b|conflict|not found|queue entry/i.test(message)) {
    console.info(`[worker] Task ${taskId} was claimed by another worker: ${message}`);
  } else {
    console.error(`[worker] Failed to claim task ${taskId}: ${message}`);
  }
}

async function processNextQueuedTask(
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
  activityGatewayClient: ExecutionActivityGatewayClient,
): Promise<void> {
  const queueResponse = await client.executions.TaskExecutionQueueController_listQueue({ limit: 25 });
  console.log(`[worker] Queue poll succeeded. ${queueResponse.total} task(s) ready.`);

  const nextTask = queueResponse.items.find(
    (item) => !isTaskClaimDeferred(item.taskId),
  );
  if (!nextTask) {
    return;
  }

  void claimIfNotInFlight(nextTask.taskId, () =>
    pickQueuedTask({
      client,
      taskId: nextTask.taskId,
      baseDir: workingDirectory,
      baseUrl,
      activityGatewayClient,
    }),
  ).catch((error) => {
    logClaimFailure(nextTask.taskId, error);
  });
}

async function pickQueuedTask(params: {
  client: ApiClient;
  taskId: string;
  baseDir: string;
  baseUrl: string;
  activityGatewayClient: ExecutionActivityGatewayClient;
}): Promise<void> {
  const { pickTask } = await import('./task-picker.js');
  await pickTask(params);
}
