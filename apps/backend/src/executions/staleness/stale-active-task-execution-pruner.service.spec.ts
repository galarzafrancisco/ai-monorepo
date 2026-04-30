import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { ActiveTaskExecutionEntity } from '../active/active-task-execution.entity';
import { ExecutionInterruptEvent } from '../events/execution-interrupt.event';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';
import { TaskStatus } from '../../tasks/enums';
import { StaleActiveTaskExecutionPrunerService } from './stale-active-task-execution-pruner.service';

describe('StaleActiveTaskExecutionPrunerService', () => {
  let dataSource: DataSource;
  let eventEmitter: EventEmitter2;
  let emit: jest.Mock;
  let service: StaleActiveTaskExecutionPrunerService;

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn(),
    } as unknown as DataSource;
    emit = jest.fn();
    eventEmitter = {
      emit,
    } as unknown as EventEmitter2;
    service = new StaleActiveTaskExecutionPrunerService(
      dataSource,
      eventEmitter,
    );
  });

  it('emits an interrupt request after pruning a stale execution', async () => {
    const execution = {
      id: 'execution-1',
      taskId: 'task-1',
      claimedAt: new Date('2026-04-30T10:00:00.000Z'),
      taskStatusBeforeClaim: TaskStatus.IN_PROGRESS,
      taskTagsBeforeClaim: [],
      taskAssigneeActorIdBeforeClaim: 'actor-1',
      agentActorId: 'agent-1',
      workerClientId: 'worker-1',
      lastHeartbeatAt: null,
      runnerSessionId: null,
      toolCallCount: 0,
      stats: null,
      rowVersion: 1,
      createdAt: new Date('2026-04-30T10:00:00.000Z'),
      updatedAt: new Date('2026-04-30T10:00:00.000Z'),
      deletedAt: null,
    } as ActiveTaskExecutionEntity;
    const task = {
      id: 'task-1',
      tags: [],
    };
    const manager = {
      findOne: jest.fn()
        .mockResolvedValueOnce(execution)
        .mockResolvedValueOnce(task),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((_, value) => value),
    } as unknown as jest.Mocked<EntityManager>;

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(manager),
    );

    await expect(service.pruneExecutionById(execution.id)).resolves.toBe(true);

    expect(manager.delete).toHaveBeenCalledWith(ActiveTaskExecutionEntity, {
      id: execution.id,
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        taskId: execution.taskId,
        status: TaskExecutionHistoryStatus.STALE,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      ExecutionInterruptEvent.INTERNAL,
      expect.objectContaining({
        actor: { id: 'system' },
        payload: {
          executionId: execution.id,
          workerClientId: execution.workerClientId,
        },
      }),
    );
  });

  it('does not emit an interrupt request when no execution is pruned', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<EntityManager>;

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(manager),
    );

    await expect(service.pruneExecutionById('missing-execution')).resolves.toBe(false);

    expect(emit).not.toHaveBeenCalled();
  });
});
