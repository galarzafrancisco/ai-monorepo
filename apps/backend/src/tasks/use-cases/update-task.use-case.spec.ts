jest.mock('@taico/errors', () => ({
  ErrorCodes: { TASK_NOT_FOUND: 'TASK_NOT_FOUND' },
}));

import { ActorService } from '../../identity-provider/actor.service';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TaskStatus } from '../enums';
import { TaskEntity } from '../task.entity';
import { UpdateTaskUseCase } from './update-task.use-case';

describe('UpdateTaskUseCase', () => {
  function task(overrides: Partial<TaskEntity> = {}): TaskEntity {
    return Object.assign(new TaskEntity(), {
      id: 'task-1',
      name: 'Before',
      description: 'Before description',
      status: TaskStatus.NOT_STARTED,
      assigneeActorId: null,
      createdByActorId: 'creator-1',
      sessionId: null,
      comments: [],
      artefacts: [],
      inputRequests: [],
      tags: [],
      dependsOn: [],
      dependents: [],
      rowVersion: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      ...overrides,
    });
  }

  function createUseCase() {
    const currentTask = task();
    const dependency = task({ id: 'dependency-1' });
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'project:taico',
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    const findOne = jest
      .spyOn(taskRepository, 'findOne')
      .mockResolvedValue(currentTask);
    const findBy = jest
      .spyOn(taskRepository, 'findBy')
      .mockResolvedValue([dependency]);
    const save = jest
      .spyOn(taskRepository, 'save')
      .mockResolvedValue(currentTask);

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

    const actorService = Object.create(ActorService.prototype) as ActorService;
    const tagWriter = Object.create(
      TransactionalTagWriterService.prototype,
    ) as TransactionalTagWriterService;
    jest.spyOn(tagWriter, 'findOrCreate').mockResolvedValue([tag]);
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );

    return {
      useCase: new UpdateTaskUseCase(
        dataSource,
        actorService,
        tagWriter,
        outboxWriter,
      ),
      currentTask,
      manager,
      findOne,
      findBy,
      save,
      tagWriter,
      enqueue,
    };
  }

  it('changes fields and relations, then records the update with one manager', async () => {
    const { useCase, currentTask, manager, save, tagWriter, enqueue } =
      createUseCase();

    const result = await useCase.execute(
      currentTask.id,
      {
        name: 'After',
        tagNames: ['project:taico'],
        dependsOnIds: ['dependency-1'],
      },
      'actor-1',
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'After',
        tags: [expect.objectContaining({ id: 'tag-1' })],
        dependsOn: [expect.objectContaining({ id: 'dependency-1' })],
      }),
    );
    expect(tagWriter.findOrCreate).toHaveBeenCalledWith(manager, [
      'project:taico',
    ]);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_UPDATED,
        payload: { taskId: 'task-1', actorId: 'actor-1' },
      }),
    );
    expect(result).toBe(currentTask);
  });

  it('does not save or enqueue when a dependency is missing', async () => {
    const { useCase, currentTask, findBy, save, enqueue } = createUseCase();
    findBy.mockResolvedValue([]);

    await expect(
      useCase.execute(currentTask.id, { dependsOnIds: ['missing'] }, 'actor-1'),
    ).rejects.toThrow('One or more dependency tasks not found');

    expect(save).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
