import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ApiClient } from '@taico/client/v2';
import type {
  PostExecutionTracePayload,
  ExecutionStepEvent,
} from '@taico/events';
import { pickTask } from '../task-picker.js';
import { ClaudeAgentRunner } from '../runners/ClaudeAgentRunner.js';
import {
  InterruptedExecutionError,
  CancelledExecutionError,
} from '../task-execution-errors.js';
import {
  activeExecutionAbortControllers,
  activeExecutionInterruptHandlers,
} from '../worker-app.js';
import { HarnessTraceRecorder } from '../harness-trace-recorder.js';
import type { ExecutionActivityGatewayClient } from '../execution-activity-gateway-client.js';

for (const outcome of [
  'success',
  'preparation-failure',
  'setup-failure',
  'failure',
  'interrupted',
  'cancelled',
  'save-failure',
] as const) {
  test(`execution lifecycle persists ${outcome} and finalization without losing harness events`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'taico-lifecycle-'));
    const batches: PostExecutionTracePayload[] = [];
    const error =
      outcome === 'interrupted'
        ? new InterruptedExecutionError('Stopped by the user')
        : outcome === 'cancelled'
          ? new CancelledExecutionError('Agent stopped')
          : new Error(outcome);
    const raw = {
      type: 'assistant',
      message: { id: 'm1', content: [{ type: 'text', text: 'Working' }] },
    };
    t.mock.method(
      ClaudeAgentRunner.prototype,
      'run',
      async (_ctx, callbacks) => {
        callbacks?.onRawEvent?.(raw);
        if (['failure', 'interrupted', 'cancelled'].includes(outcome))
          throw error;
        return { result: 'done', events: [], sessionId: null };
      },
    );
    const taskId = `task-${outcome}`;
    const executionId = `execution-${outcome}`;
    let savedStatus: string | undefined;
    const client = {
      task: {
        TasksController_getTask: async () => {
          if (outcome === 'preparation-failure') throw error;
          return { id: taskId, assigneeActor: { slug: 'agent' }, tags: [] };
        },
      },
      agent: {
        AgentsController_getAgentBySlug: async () => ({
          actorId: 'actor',
          slug: 'agent',
          type: 'claude',
          systemPrompt: 'test',
        }),
        AgentToolPermissionsController_listAgentToolPermissions: async () => {
          if (outcome === 'setup-failure') throw error;
          return [];
        },
      },
      threads: { ThreadsController_getThreadByTaskId: async () => null },
      agentExecutionTokens: {
        AgentExecutionTokensController_requestExecutionToken: async () => ({
          token: 'fixture-token',
        }),
      },
      executions: {
        TaskExecutionQueueController_claimTask: async () => ({
          id: executionId,
          taskId,
        }),
        ActiveTaskExecutionController_updateExecutionStats: async () => ({}),
        ActiveTaskExecutionController_stopTaskExecution: async ({
          body,
        }: {
          body: { status: string };
        }) => {
          if (outcome === 'save-failure') throw error;
          savedStatus = body.status;
          return { status: body.status };
        },
      },
    } as unknown as ApiClient;
    try {
      const work = pickTask({
        client,
        taskId,
        baseDir: directory,
        baseUrl: 'http://unused',
        activityGatewayClient: {
          queueTrace: async (batch: PostExecutionTracePayload) => {
            batches.push(batch);
          },
        } as unknown as ExecutionActivityGatewayClient,
      });
      if (
        [
          'preparation-failure',
          'setup-failure',
          'failure',
          'save-failure',
        ].includes(outcome)
      )
        await assert.rejects(work);
      else await work;
      const events = batches.flatMap((batch) =>
        batch.events.map((event) => ({ ...event, harness: batch.harness })),
      );
      assert.deepEqual(
        events.map((event) => event.sequence),
        Array.from({ length: events.length }, (_, i) => i + 1),
      );
      const lifecycle = events
        .filter((event) => event.harness === 'worker')
        .map((event) => event.payload as unknown as ExecutionStepEvent);
      assert.equal(lifecycle[0].step, 'workspace');
      assert.equal(lifecycle[0].status, 'running');
      assert.equal(lifecycle.at(-1)?.step, 'finish');
      assert.equal(
        lifecycle.at(-1)?.status,
        outcome === 'save-failure' ? 'failed' : 'completed',
      );
      if (outcome === 'success') {
        assert.deepEqual(
          lifecycle
            .filter((event) => event.status === 'completed')
            .map((event) => event.step),
          ['workspace', 'setup', 'agent', 'finish'],
        );
        assert.match(
          lifecycle.find(
            (event) =>
              event.step === 'workspace' && event.status === 'completed',
          )?.message ?? '',
          /No repositories/,
        );
        assert.equal(savedStatus, 'SUCCEEDED');
      }
      if (outcome === 'preparation-failure' || outcome === 'setup-failure') {
        assert.equal(
          lifecycle.find((event) => event.status === 'failed')?.step,
          outcome === 'preparation-failure' ? 'workspace' : 'setup',
        );
        assert.ok(!lifecycle.some((event) => event.step === 'agent'));
      } else {
        assert.deepEqual(
          events.find((event) => event.harness === 'claude')?.payload,
          raw,
        );
      }
      if (outcome === 'interrupted' || outcome === 'cancelled') {
        assert.equal(
          lifecycle.find(
            (event) => event.step === 'agent' && event.status !== 'running',
          )?.status,
          outcome,
        );
        assert.equal(savedStatus, 'CANCELLED');
      }
      assert.equal(activeExecutionAbortControllers.has(executionId), false);
      assert.equal(activeExecutionInterruptHandlers.has(executionId), false);
    } finally {
      await rm(directory, { recursive: true, force: true });
      t.mock.restoreAll();
    }
  });
}

test('one sequence spans alternating worker and harness batches', async () => {
  const batches: PostExecutionTracePayload[] = [];
  const recorder = new HarnessTraceRecorder(
    'execution',
    'worker',
    async (batch) => {
      batches.push(batch);
    },
  );
  recorder.workerStep({ step: 'workspace', status: 'running' });
  recorder.setHarness('claude');
  recorder.capture({ text: 'raw' });
  recorder.workerStep({ step: 'finish', status: 'completed' });
  await recorder.close();
  assert.deepEqual(
    batches.map((batch) => batch.harness),
    ['worker', 'claude', 'worker'],
  );
  assert.deepEqual(
    batches.flatMap((batch) => batch.events.map((event) => event.sequence)),
    [1, 2, 3],
  );
});
