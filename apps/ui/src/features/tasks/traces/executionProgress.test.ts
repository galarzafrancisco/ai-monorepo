import { describe, it, expect } from 'vitest';
import { buildExecutionSteps } from './executionProgress';
import { buildTraceEntries, type TraceEvent } from './traceEntries';
const event = (sequence: number, payload: unknown): TraceEvent => ({
  executionId: 'execution',
  sequence,
  harness: 'worker',
  payload: payload as TraceEvent['payload'],
  runnerSessionId: null,
  emittedAt: '2026-10-27T00:00:00Z',
  receivedAt: '2026-10-27T00:00:00Z',
});
const step = (sequence: number, id: string, status: string, extra = {}) =>
  event(sequence, { type: 'taico.execution.step', step: id, status, ...extra });
describe('execution progress', () => {
  it('shows recorded progress and each repository outcome', () => {
    const repository = {
      slug: 'app',
      repository: 'github.com/org/app',
      action: 'clone',
    };
    const events = [
      step(1, 'workspace', 'running', {
        repository: { ...repository, status: 'running' },
      }),
      step(2, 'workspace', 'running', {
        repository: { ...repository, status: 'completed' },
      }),
      step(3, 'workspace', 'completed'),
      step(4, 'setup', 'completed'),
      step(5, 'agent', 'running'),
    ];
    const steps = buildExecutionSteps(events, false, false);
    expect(steps.map((step) => step.status)).toEqual([
      'completed',
      'completed',
      'running',
      'pending',
    ]);
    expect(steps[0].repositories).toEqual([
      { ...repository, status: 'completed' },
    ]);
    expect(buildTraceEntries(events)).toEqual([]);
  });
  it.each(['failed', 'interrupted', 'cancelled'])(
    'keeps %s distinct while finalization completes',
    (status) => {
      const steps = buildExecutionSteps(
        [
          step(1, 'workspace', 'completed'),
          step(2, 'setup', 'completed'),
          step(3, 'agent', status, { message: 'Execution stopped' }),
          step(4, 'finish', 'completed'),
        ],
        true,
        false,
      );
      expect(steps.map((step) => step.status)).toEqual([
        'completed',
        'completed',
        status,
        'completed',
      ]);
      expect(steps[2].message).toBe('Execution stopped');
    },
  );
  it('does not invent completed steps for old runs or missing lifecycle events', () => {
    expect(buildExecutionSteps([], true, false)).toEqual([]);
    const steps = buildExecutionSteps(
      [step(1, 'workspace', 'failed')],
      true,
      false,
    );
    expect(steps.map((step) => step.status)).toEqual([
      'failed',
      'not_run',
      'not_run',
      'not_run',
    ]);
  });
  it('stops showing progress as running after a stale worker disappears', () => {
    const steps = buildExecutionSteps(
      [
        step(1, 'workspace', 'running', {
          repository: {
            slug: 'app',
            repository: '/repo',
            action: 'clone',
            status: 'running',
          },
        }),
      ],
      true,
      true,
    );
    expect(steps[0].status).toBe('stale');
    expect(steps[0].repositories[0].status).toBe('stopped');
  });
  it('preserves explicit no-repository preparation details', () => {
    expect(
      buildExecutionSteps(
        [
          step(1, 'workspace', 'completed', {
            message: 'No repositories configured.',
          }),
        ],
        false,
        false,
      )[0].message,
    ).toBe('No repositories configured.');
  });
});
