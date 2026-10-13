import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTaskClaimWorker, attemptClaimTask } from '../src/task-claim-worker.js';
import {
  WorkerShutdownCoordinator,
  activeExecutionAbortControllers,
  activeExecutionInterruptHandlers,
} from '../src/worker-app.js';

test('runTaskClaimWorker exits when aborted during sleep', async () => {
  const abortController = new AbortController();
  const client = createQueueClient([]);
  const startedAt = Date.now();

  setTimeout(() => abortController.abort(), 10);

  await runTaskClaimWorker(
    client,
    '/tmp/worker-test',
    'http://localhost:3000',
    createActivityGatewayClient(),
    {
      signal: abortController.signal,
      pollIntervalMs: 10_000,
    },
  );

  assert.equal(client.listQueueCalls, 1);
  assert.ok(Date.now() - startedAt < 1_000);
});

test('queue notifications do not claim tasks after shutdown starts', async () => {
  let pickTaskCalls = 0;

  await attemptClaimTask(
    'task-1',
    createQueueClient([]),
    '/tmp/worker-test',
    'http://localhost:3000',
    createActivityGatewayClient(),
    {
      shouldClaimTask: () => false,
      pickTaskFn: async () => {
        pickTaskCalls += 1;
      },
    },
  );

  assert.equal(pickTaskCalls, 0);
});

test('polling does not claim tasks after shutdown starts', async () => {
  const abortController = new AbortController();
  let pickTaskCalls = 0;

  setTimeout(() => abortController.abort(), 10);

  await runTaskClaimWorker(
    createQueueClient(['task-1']),
    '/tmp/worker-test',
    'http://localhost:3000',
    createActivityGatewayClient(),
    {
      signal: abortController.signal,
      shouldClaimTask: () => false,
      pollIntervalMs: 10_000,
      pickTaskFn: async () => {
        pickTaskCalls += 1;
      },
    },
  );

  assert.equal(pickTaskCalls, 0);
});

test('shutdown calls ExecutionActivityGatewayClient.stop', async () => {
  const coordinator = new WorkerShutdownCoordinator({ graceMs: 10 });
  let stopCalls = 0;

  coordinator.beginShutdown('SIGTERM');
  await coordinator.shutdown({
    stop: async () => {
      stopCalls += 1;
    },
  });

  assert.equal(stopCalls, 1);
});

test('shutdown waits for active executions that complete within grace', async () => {
  const coordinator = new WorkerShutdownCoordinator({ graceMs: 1_000 });
  let resolveExecution!: () => void;
  const execution = new Promise<void>((resolve) => {
    resolveExecution = resolve;
  });

  coordinator.getTaskClaimOptions().trackTaskExecution('task-1', execution);
  coordinator.beginShutdown('SIGTERM');
  setTimeout(resolveExecution, 10);

  await coordinator.shutdown(createActivityGatewayClient());

  assert.equal(activeExecutionAbortControllers.size, 0);
});

test('shutdown interrupts active executions after grace elapses', async () => {
  const coordinator = new WorkerShutdownCoordinator({ graceMs: 1 });
  const executionAbortController = new AbortController();
  let interruptCalls = 0;
  let stoppedExecutionId: string | undefined;

  activeExecutionAbortControllers.set('execution-1', executionAbortController);
  activeExecutionInterruptHandlers.set('execution-1', () => {
    interruptCalls += 1;
  });
  coordinator.getTaskClaimOptions().trackTaskExecution('task-1', new Promise(() => {}));
  coordinator.beginShutdown('SIGTERM');

  await coordinator.shutdown(createActivityGatewayClient(), {
    executions: {
      ActiveTaskExecutionController_stopTaskExecution: async ({ executionId }: { executionId: string }) => {
        stoppedExecutionId = executionId;
        return { status: 'CANCELLED' };
      },
    },
  } as any);

  assert.equal(executionAbortController.signal.aborted, true);
  assert.equal(interruptCalls, 1);
  assert.equal(stoppedExecutionId, 'execution-1');

  activeExecutionAbortControllers.clear();
  activeExecutionInterruptHandlers.clear();
});

function createQueueClient(taskIds: string[]) {
  const client = {
    listQueueCalls: 0,
    executions: {
      TaskExecutionQueueController_listQueue: async () => {
        client.listQueueCalls += 1;
        return {
          total: taskIds.length,
          items: taskIds.map((taskId) => ({ taskId })),
        };
      },
    },
  };

  return client as any;
}

function createActivityGatewayClient() {
  return {
    stop: async () => {},
  } as any;
}
