jest.mock('@taico/errors', () => ({
  ErrorCodes: { TASK_NOT_FOUND: 'TASK_NOT_FOUND' },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { TaskStatus } from '../enums';
import { TaskEntity } from '../task.entity';
import { AssignTaskUseCase } from './assign-task.use-case';

describe('AssignTaskUseCase', () => {
  function createUseCase(existingAssignee: string | null = null) {
    const task = Object.assign(new TaskEntity(), {
      id: 'task-1',
      assigneeActorId: existingAssignee,
      sessionId: null,
      status: TaskStatus.NOT_STARTED,
      comments: [],
      artefacts: [],
      inputRequests: [],
      tags: [],
      dependsOn: [],
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    const findOne = jest
      .spyOn(taskRepository, 'findOne')
      .mockResolvedValue(task);
    const save = jest.spyOn(taskRepository, 'save').mockResolvedValue(task);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    jest.spyOn(manager, 'getRepository').mockReturnValue(taskRepository);
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
      useCase: new AssignTaskUseCase(dataSource, outboxWriter),
      manager,
      task,
      findOne,
      save,
      enqueue,
    };
  }

  it('assigns, reloads, and enqueues the assignment in one transaction', async () => {
    const { useCase, manager, task, findOne, save, enqueue } = createUseCase();

    const result = await useCase.execute(
      task.id,
      { assigneeActorId: 'assignee-1', sessionId: 'session-1' },
      'actor-1',
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeActorId: 'assignee-1',
        sessionId: 'session-1',
      }),
    );
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_ASSIGNED,
        payload: { taskId: task.id, actorId: 'actor-1' },
      }),
    );
    expect(result).toBe(task);
  });

  it('leaves an existing identical assignment untouched', async () => {
    const { useCase, task, save, enqueue } = createUseCase('assignee-1');

    const result = await useCase.execute(
      task.id,
      { assigneeActorId: 'assignee-1' },
      'actor-1',
    );

    expect(save).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(result).toBe(task);
  });
});
