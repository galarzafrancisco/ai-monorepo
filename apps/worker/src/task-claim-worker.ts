import { setTimeout as sleep } from 'timers/promises';
import { ApiClient } from '@taico/client/v2';
import { pickTask } from './task-picker.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';

const QUEUE_POLL_INTERVAL_MS = 60_000;

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
    await pickTask({
      client,
      taskId,
      baseDir: workingDirectory,
      baseUrl,
      activityGatewayClient,
    });
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
): Promise<void> {
  const queueResponse = await client.executions.TaskExecutionQueueController_listQueue({ limit: 1 });
  console.log(`[worker] Queue poll succeeded. ${queueResponse.total} task(s) ready.`);

  const nextTask = queueResponse.items[0];
  if (!nextTask) {
    return;
  }

  void pickTask({
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
}
