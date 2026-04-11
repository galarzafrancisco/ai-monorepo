import { ApiClient } from '@taico/client/v2';
import { executeTask } from './task-runner.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';
import { TaskExecutionError } from './task-execution-errors.js';

type PickTaskParams = {
  client: ApiClient;
  taskId: string;
  baseDir: string;
  baseUrl: string;
  activityGatewayClient: ExecutionActivityGatewayClient;
}

export async function pickTask({
  client,
  taskId,
  baseDir,
  baseUrl,
  activityGatewayClient,
}: PickTaskParams): Promise<void> {
  console.log(`[worker] Attempting to claim task ${taskId}.`);

  const execution =
    await client.executions.TaskExecutionQueueController_claimTask({
      taskId,
    });

  console.log(
    `[worker] Claimed task ${execution.taskId} as execution ${execution.id}.`,
  );

  let stopStatus: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' = 'SUCCEEDED';
  let stopErrorCode: 'OUT_OF_QUOTA' | 'UNKNOWN' | undefined;
  let stopErrorMessage: string | undefined;

  try {
    await executeTask({
      taskId: execution.taskId,
      executionId: execution.id,
      workerClient: client,
      baseDir: baseDir,
      baseUrl,
      activityGatewayClient,
    });
  } catch (error) {
    if (error instanceof TaskExecutionError) {
      stopStatus = error.kind === 'cancelled' ? 'CANCELLED' : 'FAILED';
      stopErrorCode = error.kind === 'cancelled' ? undefined : error.errorCode;
      stopErrorMessage = error.displayMessage;
    } else {
      stopStatus = 'FAILED';
      stopErrorCode = 'UNKNOWN';
      stopErrorMessage =
        error instanceof Error ? error.message : String(error);
    }
    throw error;
  } finally {
    const historyEntry =
      await client.executions.ActiveTaskExecutionController_stopTaskExecution({
        executionId: execution.id,
        body: {
          status: stopStatus,
          errorCode: stopErrorCode,
          errorMessage: stopErrorMessage,
        },
      });

    console.log(
      `[worker] Stopped execution ${execution.id} with status ${historyEntry.status}.`,
    );
  }
}
