import { ThreadTimerKind } from '../timers/thread-timer.enums';
import { ThreadAgentToolsFactory } from './thread-agent-tools.factory';
import { LIST_WAITS_TOOL, REMIND_TOOL, SCHEDULE_TOOL } from './thread-agent.prompts';

jest.mock('../task-subscriptions/thread-task-subscriptions.service', () => ({
  ThreadTaskSubscriptionsService: class {},
}));
jest.mock('../timers/thread-timers.service', () => ({ ThreadTimersService: class {} }));
jest.mock('../time/thread-time.service', () => ({ ThreadTimeService: class {} }));

const NOW = new Date('2026-10-16T10:36:12Z');

type Executable = { execute: (args: unknown, options: unknown) => Promise<unknown> };

function setup(now?: () => Date) {
  const create = jest.fn(async (input: { firstFireAt: Date; maxIterations: number }) => ({
    id: 'timer-1',
    nextFireAt: input.firstFireAt,
    maxIterations: input.maxIterations,
  }));
  const timers = { create, listActive: jest.fn(async () => []) };
  const subscriptions = { listForThread: jest.fn(async () => []) };
  const factory = new ThreadAgentToolsFactory(subscriptions as never, timers as never, {} as never);
  const tools = factory.build({ threadId: 'thread-1', agentActorId: 'agent-1', forActorId: 'user-1', now });
  const run = (name: string, args: unknown) =>
    (tools[name] as unknown as Executable).execute(args, { toolCallId: 'call-1', messages: [] });
  return { run, create };
}

describe('ThreadAgentToolsFactory clock', () => {
  it('remind measures `in` from the injected clock', async () => {
    const { run, create } = setup(() => NOW);

    const result = (await run(REMIND_TOOL, { in: '5m', reason: 'stretch' })) as { now: string };

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: ThreadTimerKind.REMINDER,
        firstFireAt: new Date('2026-10-16T10:41:12Z'),
      }),
    );
    expect(result.now).toBe(NOW.toISOString());
  });

  it('remind judges `at` as past or future against the injected clock', async () => {
    const { run, create } = setup(() => NOW);

    await expect(run(REMIND_TOOL, { at: '2026-10-16T10:00:00Z', reason: 'x' })).resolves.toEqual({
      error: expect.stringContaining('it is now 2026-10-16T10:36:12.000Z'),
    });
    expect(create).not.toHaveBeenCalled();

    await run(REMIND_TOOL, { at: '2026-10-17T10:00:00+11:00', reason: 'x' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ firstFireAt: new Date('2026-10-16T23:00:00Z') }),
    );
  });

  it('schedule and the waits list use the injected clock', async () => {
    const { run, create } = setup(() => NOW);

    await run(SCHEDULE_TOOL, { period: '1h', maxIterations: 2, reason: 'check' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ firstFireAt: new Date('2026-10-16T11:36:12Z') }),
    );

    await expect(run(LIST_WAITS_TOOL, {})).resolves.toMatchObject({ now: NOW.toISOString() });
  });

  it('defaults to the real clock', async () => {
    const { run, create } = setup();
    const before = Date.now();

    await run(REMIND_TOOL, { in: '30s', reason: 'x' });

    const fireAt = (create.mock.calls[0][0] as { firstFireAt: Date }).firstFireAt.getTime();
    expect(fireAt).toBeGreaterThanOrEqual(before + 30_000);
    expect(fireAt).toBeLessThanOrEqual(Date.now() + 30_000);
  });
});
