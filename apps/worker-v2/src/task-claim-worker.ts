import { setTimeout as sleep } from 'timers/promises';
import { ApiClient } from '@taico/client/v2';
import { pickTask } from './task-picker.js';

const QUEUE_POLL_INTERVAL_MS = 1_000;

export async function runTaskClaimWorker(
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
): Promise<void> {
  console.log(
    `[worker] Polling executions-v2 queue every ${QUEUE_POLL_INTERVAL_MS / 1000}s.`,
  );

  while (true) {
    try {
      await processNextQueuedTask(client, workingDirectory, baseUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Queue poll failed: ${message}`);
    }

    await sleep(QUEUE_POLL_INTERVAL_MS);
  }
}

async function processNextQueuedTask(
  client: ApiClient,
  workingDirectory: string,
  baseUrl: string,
): Promise<void> {
  const queue = await client.executionsV2.TaskExecutionQueueController_listQueue();
  console.log(`[worker] Queue poll succeeded. ${queue.length} task(s) ready.`);

  const nextTask = queue[0];
  if (!nextTask) {
    return;
  }

  void pickTask({
    client,
    taskId: nextTask.taskId,
    baseDir: workingDirectory,
    baseUrl,
  })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[worker] Task processing failed for ${nextTask.taskId}: ${message}`,
      );
    });
}
