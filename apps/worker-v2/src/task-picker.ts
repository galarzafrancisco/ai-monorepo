import { ApiClient } from '@taico/client/v2';
import { executeTask } from './task-runner.js';

type PickTaskParams = {
  client: ApiClient;
  taskId: string;
  baseDir: string;
  baseUrl: string;
}

export async function pickTask({
  client,
  taskId,
  baseDir,
  baseUrl,
}: PickTaskParams): Promise<void> {
  console.log(`[worker] Attempting to claim task ${taskId}.`);

  const execution =
    await client.executionsV2.TaskExecutionQueueController_claimTask({
      taskId,
    });

  console.log(
    `[worker] Claimed task ${execution.taskId} as execution ${execution.id}.`,
  );

  let stopStatus: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED';
  let stopErrorCode: 'UNKNOWN' | undefined;

  try {
    await executeTask({
      taskId: execution.taskId,
      executionId: execution.id,
      workerClient: client,
      baseDir: baseDir,
      baseUrl,
    });
  } catch (error) {
    stopStatus = 'FAILED';
    stopErrorCode = 'UNKNOWN';
    throw error;
  } finally {
    const historyEntry =
      await client.executionsV2.ActiveTaskExecutionController_stopTaskExecution({
        executionId: execution.id,
        body: {
          status: stopStatus,
          errorCode: stopErrorCode,
        },
      });

    console.log(
      `[worker] Stopped execution ${execution.id} with status ${historyEntry.status}.`,
    );
  }
}
