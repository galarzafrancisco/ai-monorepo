import { ExecutionTracesChangedEvent } from '../events/execution-traces-changed.event';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import type { PostExecutionTracePayload } from '@taico/events';
import { ExecutionTracesService } from './execution-traces.service';
import { ExecutionTraceEntity } from './execution-trace.entity';
import {
  ExecutionTraceNotFoundError,
  ExecutionTraceWorkerMismatchError,
  InvalidExecutionTraceError,
} from './execution-traces.errors';

const executionId = 'd73507cc-1469-4a97-8530-5fb3b6447e32';
const batch = (): PostExecutionTracePayload => ({
  executionId,
  harness: 'claude',
  events: [
    {
      sequence: 1,
      emittedAt: '2026-10-27T00:00:00.000Z',
      runnerSessionId: null,
      payload: { type: 'tool_result', result: ['full'] },
    },
  ],
});

describe('ExecutionTracesService', () => {
  let query: jest.Mock;
  let find: jest.Mock;
  let service: ExecutionTracesService;
  let emit: jest.Mock;
  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{ workerClientId: 'owner' }]);
    find = jest.fn().mockResolvedValue([]);
    emit = jest.fn();
    service = new ExecutionTracesService(
      {
        query,
        find,
      } as unknown as Repository<ExecutionTraceEntity>,
      { emit } as unknown as EventEmitter2,
    );
  });

  it('stores the entire JSON payload in one idempotent batch insert after resolving ownership', async () => {
    const input = batch();
    await service.append(input, 'owner');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('UNION ALL');
    expect(query.mock.calls[1][0]).toContain(
      'ON CONFLICT (execution_id, sequence) DO NOTHING',
    );
    expect(query.mock.calls[1][1]).toEqual([
      executionId,
      input.harness,
      1,
      input.events[0].emittedAt,
      null,
      JSON.stringify(input.events[0].payload),
    ]);
  });

  it('rejects another worker without inserting', async () => {
    await expect(service.append(batch(), 'other')).rejects.toBeInstanceOf(
      ExecutionTraceWorkerMismatchError,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing execution without inserting', async () => {
    query.mockResolvedValue([]);
    await expect(service.append(batch(), 'owner')).rejects.toBeInstanceOf(
      ExecutionTraceNotFoundError,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { ...batch(), executionId: 'not-a-uuid' },
    { ...batch(), harness: '' },
    { ...batch(), events: [] },
    { ...batch(), events: Array(101).fill(batch().events[0]) },
    { ...batch(), events: [{ ...batch().events[0], sequence: 0 }] },
    { ...batch(), events: [{ ...batch().events[0], sequence: 1.5 }] },
    { ...batch(), events: [{ ...batch().events[0], emittedAt: 'yesterday' }] },
    { ...batch(), events: [{ ...batch().events[0], runnerSessionId: 123 }] },
    {
      ...batch(),
      events: [
        {
          sequence: 1,
          emittedAt: batch().events[0].emittedAt,
          runnerSessionId: null,
        },
      ],
    },
    { ...batch(), events: [batch().events[0], batch().events[0]] },
  ])(
    'rejects invalid trace batches before accessing the database (%#)',
    async (input) => {
      await expect(
        service.append(input as PostExecutionTracePayload, 'owner'),
      ).rejects.toBeInstanceOf(InvalidExecutionTraceError);
      expect(query).not.toHaveBeenCalled();
    },
  );

  it('accepts raw JSON null without turning it into a missing payload', async () => {
    const input = batch();
    input.events[0].payload = null;
    await service.append(input, 'owner');
    expect(JSON.parse(query.mock.calls[1][1][5])).toBeNull();
  });

  it('returns a stable cursor on an empty page and orders events by sequence', async () => {
    expect(await service.list(executionId, 5, 10)).toEqual({
      items: [],
      nextAfterSequence: 5,
      hasMoreBefore: false,
    });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { sequence: 'ASC' }, take: 11 }),
    );
    find.mockResolvedValue([{ sequence: 9 }]);
    expect((await service.list(executionId, 5, 10)).nextAfterSequence).toBe(9);
  });

  it('notifies viewers only after a successful durable insert', async () => {
    await service.append(batch(), 'owner');
    expect(emit).toHaveBeenCalledWith(
      ExecutionTracesChangedEvent.INTERNAL,
      expect.objectContaining({ executionId }),
    );
    emit.mockClear();
    query
      .mockResolvedValueOnce([{ workerClientId: 'owner' }])
      .mockRejectedValueOnce(new Error('write failed'));
    await expect(service.append(batch(), 'owner')).rejects.toThrow(
      'write failed',
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('opens at the latest events and returns them chronologically with earlier-page metadata', async () => {
    find.mockResolvedValue([{ sequence: 5 }, { sequence: 4 }, { sequence: 3 }]);
    expect(await service.list(executionId, 0, 2, { latest: true })).toEqual({
      items: [{ sequence: 4 }, { sequence: 5 }],
      nextAfterSequence: 5,
      hasMoreBefore: true,
    });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { sequence: 'DESC' }, take: 3 }),
    );
  });

  it('does not infer earlier events from gaps in the sequence', async () => {
    find.mockResolvedValue([{ sequence: 4 }, { sequence: 3 }]);
    const page = await service.list(executionId, 0, 2, { beforeSequence: 5 });
    expect(page.items.map((item) => item.sequence)).toEqual([3, 4]);
    expect(page.hasMoreBefore).toBe(false);
  });
});
