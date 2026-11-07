import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { WorkerEntity } from './worker.entity';
import { WorkersService } from './workers.service';

describe('WorkersService', () => {
  it('preserves a concurrent capability report when a heartbeat finishes later', async () => {
    const stored = {
      oauthClientId: 'worker-1',
      capabilities: null,
    } as WorkerEntity;
    const repository = {
      upsert: jest.fn(async (fields: Partial<WorkerEntity>) => {
        // Simulate the heartbeat being delayed while the report is persisted.
        if (!fields.capabilities) await new Promise((resolve) => setTimeout(resolve, 10));
        Object.assign(stored, fields);
      }),
      findOneByOrFail: jest.fn(async () => ({ ...stored })),
    };
    const service = new WorkersService(
      repository as unknown as Repository<WorkerEntity>,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const capabilities = {
      os: 'darwin', architecture: 'arm64', opencode: true,
      claudeAuthenticated: true, git: true, gh: false,
    };

    await Promise.all([
      service.recordWorkerSeen('00000000-0000-4000-8000-000000000001', { oauthClientId: 'worker-1', workerVersion: '1.0' }),
      service.recordWorkerSeen('00000000-0000-4000-8000-000000000001', { oauthClientId: 'worker-1', capabilities }),
    ]);

    expect(stored.capabilities).toEqual(capabilities);
    expect(stored.workerVersion).toBe('1.0');
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ capabilities }),
      { conflictPaths: ['workspaceId', 'oauthClientId'] },
    );
    expect(repository.upsert.mock.calls[0][0]).not.toHaveProperty('capabilities');
  });
});
