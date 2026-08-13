jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
    TASK_IS_THREAD_PARENT: 'TASK_IS_THREAD_PARENT',
  },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../../threads/thread.entity';
import { TaskIsThreadParentError } from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';
import { DeleteTaskUseCase } from './delete-task.use-case';

describe('DeleteTaskUseCase', () => {
  function createUseCase(parentThreadCount = 0) {
    const task = Object.assign(new TaskEntity(), { id: 'task-1' });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const softRemove = jest
      .spyOn(taskRepository, 'softRemove')
      .mockResolvedValue(task);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    jest.spyOn(manager, 'getRepository').mockReturnValue(taskRepository);
    const count = jest
      .spyOn(manager, 'count')
      .mockResolvedValue(parentThreadCount);
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );

    return {
      useCase: new DeleteTaskUseCase(dataSource, outboxWriter),
      manager,
      task,
      softRemove,
      count,
      enqueue,
    };
  }

  it('checks parent threads, soft-deletes, and enqueues the delete in one transaction', async () => {
    const { useCase, manager, task, softRemove, count, enqueue } =
      createUseCase();

    await useCase.execute(task.id, 'actor-1');

    expect(count).toHaveBeenCalledWith(ThreadEntity, {
      where: { parentTaskId: task.id },
    });
    expect(softRemove).toHaveBeenCalledWith(task);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_DELETED,
        payload: { taskId: task.id, actorId: 'actor-1' },
      }),
    );
  });

  it('does not delete or enqueue when the task is a thread parent', async () => {
    const { useCase, task, softRemove, enqueue } = createUseCase(1);

    await expect(useCase.execute(task.id, 'actor-1')).rejects.toBeInstanceOf(
      TaskIsThreadParentError,
    );

    expect(softRemove).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
