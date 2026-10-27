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
  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{ workerClientId: 'owner' }]);
    find = jest.fn().mockResolvedValue([]);
    service = new ExecutionTracesService({
      query,
      find,
    } as unknown as Repository<ExecutionTraceEntity>);
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
    });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { sequence: 'ASC' }, take: 10 }),
    );
    find.mockResolvedValue([{ sequence: 9 }]);
    expect((await service.list(executionId, 5, 10)).nextAfterSequence).toBe(9);
  });
});
