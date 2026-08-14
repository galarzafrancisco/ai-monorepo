jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActiveTaskExecutionWorkerMismatchError } from '../errors/executions.errors';
import { ExecutionActivityService } from '../execution-activity.service';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';
import { ActiveTaskExecutionEntity } from './active-task-execution.entity';
import { ActiveTaskExecutionService } from './active-task-execution.service';

describe('ActiveTaskExecutionService.stopTask', () => {
  it('refuses to stop an execution claimed by a different worker', async () => {
    const execution = Object.assign(new ActiveTaskExecutionEntity(), {
      id: 'execution-1',
      workerClientId: 'worker-a',
    });
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'findOne', {
      value: jest.fn().mockResolvedValue(execution),
    });
    Object.defineProperty(manager, 'delete', { value: jest.fn() });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ActiveTaskExecutionEntity>;
    const activity = Object.create(
      ExecutionActivityService.prototype,
    ) as ExecutionActivityService;
    const eventEmitter = Object.create(
      EventEmitter2.prototype,
    ) as EventEmitter2;
    const service = new ActiveTaskExecutionService(
      repository,
      dataSource,
      activity,
      eventEmitter,
    );

    await expect(
      service.stopTask({
        executionId: execution.id,
        workerClientId: 'worker-b',
        status: TaskExecutionHistoryStatus.SUCCEEDED,
      }),
    ).rejects.toBeInstanceOf(ActiveTaskExecutionWorkerMismatchError);

    expect(manager.delete).not.toHaveBeenCalled();
  });
});
