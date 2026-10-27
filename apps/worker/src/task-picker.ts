import { ApiClient } from '@taico/client/v2';
import { HarnessTraceRecorder } from './harness-trace-recorder.js';
import { executeTask } from './task-runner.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';
import {
  TaskExecutionError,
  UnsupportedAgentTypeError,
} from './task-execution-errors.js';
import { deferTaskClaimAfterUnclaim } from './task-claim-deferral.js';

type PickTaskParams = {
  client: ApiClient;
  taskId: string;
  baseDir: string;
  baseUrl: string;
  activityGatewayClient: ExecutionActivityGatewayClient;
};

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

  const trace = new HarnessTraceRecorder(execution.id, 'worker', (batch) =>
    activityGatewayClient.queueTrace(batch),
  );
  let stopStatus: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' = 'SUCCEEDED';
  let stopErrorCode: 'OUT_OF_QUOTA' | 'INTERRUPTED' | 'UNKNOWN' | undefined;
  let stopErrorMessage: string | undefined;
  let shouldRethrow = false;
  let taskError: unknown;
  let shouldUnclaim = false;

  try {
    await executeTask({
      taskId: execution.taskId,
      executionId: execution.id,
      workerClient: client,
      baseDir: baseDir,
      baseUrl,
      activityGatewayClient,
      trace,
    });
  } catch (error) {
    if (error instanceof UnsupportedAgentTypeError) {
      shouldUnclaim = true;
      stopErrorMessage = error.displayMessage;
    } else if (error instanceof TaskExecutionError) {
      if (error.kind === 'interrupted') {
        stopStatus = 'CANCELLED';
        stopErrorCode = 'INTERRUPTED';
        stopErrorMessage = error.displayMessage;
      } else if (error.kind === 'cancelled') {
        stopStatus = 'CANCELLED';
        stopErrorCode = undefined;
        stopErrorMessage = error.displayMessage;
      } else {
        stopStatus = 'FAILED';
        stopErrorCode = error.errorCode;
        stopErrorMessage = error.displayMessage;
        shouldRethrow = true;
      }
    } else {
      stopStatus = 'FAILED';
      stopErrorCode = 'UNKNOWN';
      stopErrorMessage = error instanceof Error ? error.message : String(error);
      shouldRethrow = true;
    }
    taskError = error;
  } finally {
    trace.workerStep({
      step: 'finish',
      status: 'running',
      message: shouldUnclaim
        ? 'Returning this task to the queue.'
        : 'Saving the execution result.',
    });
    try {
      if (shouldUnclaim) {
        await client.executions.ActiveTaskExecutionController_unclaimTaskExecution(
          {
            executionId: execution.id,
          },
        );
        deferTaskClaimAfterUnclaim(execution.taskId);

        console.log(
          `[worker] Unclaimed execution ${execution.id} for task ${execution.taskId}: ${stopErrorMessage}`,
        );
      } else {
        const historyEntry =
          await client.executions.ActiveTaskExecutionController_stopTaskExecution(
            {
              executionId: execution.id,
              body: {
                status: stopStatus,
                errorCode: stopErrorCode,
                errorMessage: stopErrorMessage,
              },
            },
          );

        console.log(
          `[worker] Stopped execution ${execution.id} with status ${historyEntry.status}.`,
        );
      }
      trace.workerStep({
        step: 'finish',
        status: 'completed',
        message: shouldUnclaim
          ? 'Task returned to the queue for a compatible worker.'
          : 'Result saved. Workspace kept for later use.',
      });
    } catch (error) {
      trace.workerStep({
        step: 'finish',
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      try {
        await trace.close();
      } catch {
        console.warn(
          `[worker] Could not close execution trace ${execution.id}`,
        );
      }
    }
  }

  if (shouldRethrow) {
    throw taskError;
  }
}
