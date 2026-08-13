jest.mock('@taico/errors', () => ({
  ErrorCodes: { TASK_NOT_FOUND: 'TASK_NOT_FOUND' },
}));

import { ActorService } from '../../identity-provider/actor.service';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ActorType } from '../../identity-provider/enums';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TaskStatus } from '../enums';
import { TaskEntity } from '../task.entity';
import { CreateTaskUseCase } from './create-task.use-case';

describe('CreateTaskUseCase', () => {
  function actor(id: string): ActorEntity {
    return Object.assign(new ActorEntity(), {
      id,
      type: ActorType.AGENT,
      slug: id,
      displayName: id,
      avatarUrl: null,
      introduction: null,
    });
  }

  function task(overrides: Partial<TaskEntity> = {}): TaskEntity {
    return Object.assign(new TaskEntity(), {
      id: 'task-1',
      name: 'Task',
      description: 'Description',
      status: TaskStatus.NOT_STARTED,
      assigneeActorId: 'assignee-1',
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
    const creator = actor('creator-1');
    const assignee = actor('assignee-1');
    const dependency = task({ id: 'dependency-1' });
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'project:taico',
    });
    const createdTask = task({
      tags: [tag],
      dependsOn: [dependency],
      assigneeActor: assignee,
      createdByActor: creator,
    });

    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    const findBy = jest
      .spyOn(taskRepository, 'findBy')
      .mockResolvedValue([dependency]);
    jest
      .spyOn(taskRepository, 'create')
      .mockImplementation((input) => Object.assign(new TaskEntity(), input));
    jest.spyOn(taskRepository, 'save').mockResolvedValue(createdTask);
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(createdTask);

    const manager = Object.create(EntityManager.prototype) as EntityManager;
    jest.spyOn(manager, 'getRepository').mockReturnValue(taskRepository);

    const dataSource = Object.create(DataSource.prototype) as DataSource;
    const transaction = jest.fn(
      async (
        callback: (transactionManager: EntityManager) => Promise<unknown>,
      ) => callback(manager),
    );
    Object.defineProperty(dataSource, 'transaction', { value: transaction });

    const actorService = Object.create(ActorService.prototype) as ActorService;
    jest
      .spyOn(actorService, 'getActorByIdOrSlug')
      .mockImplementation(async (id) =>
        id === assignee.id ? assignee : creator,
      );

    const tagWriter = Object.create(
      TransactionalTagWriterService.prototype,
    ) as TransactionalTagWriterService;
    jest.spyOn(tagWriter, 'findOrCreate').mockResolvedValue([tag]);
    jest.spyOn(tagWriter, 'incrementUsage').mockResolvedValue();

    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );

    return {
      useCase: new CreateTaskUseCase(
        dataSource,
        actorService,
        tagWriter,
        outboxWriter,
      ),
      manager,
      taskRepository,
      findBy,
      tagWriter,
      outboxWriter,
    };
  }

  it('writes task relations, tag usage, and the outbox event with one manager', async () => {
    const { useCase, manager, taskRepository, tagWriter, outboxWriter } =
      createUseCase();

    const result = await useCase.execute({
      name: 'Task',
      description: 'Description',
      assigneeActorId: 'assignee-1',
      createdByActorId: 'creator-1',
      tagNames: ['project:taico'],
      dependsOnIds: ['dependency-1'],
    });

    expect(taskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [expect.objectContaining({ id: 'tag-1' })],
        dependsOn: [expect.objectContaining({ id: 'dependency-1' })],
      }),
    );
    expect(tagWriter.findOrCreate).toHaveBeenCalledWith(manager, [
      'project:taico',
    ]);
    expect(tagWriter.incrementUsage).toHaveBeenCalledWith(manager, ['tag-1']);
    expect(outboxWriter.enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_CREATED,
        payload: { taskId: 'task-1', actorId: 'creator-1' },
      }),
    );
    expect(result.id).toBe('task-1');
  });

  it('does not create an event when a dependency is missing', async () => {
    const { useCase, findBy, tagWriter, outboxWriter } = createUseCase();
    findBy.mockResolvedValue([]);

    await expect(
      useCase.execute({
        name: 'Task',
        description: 'Description',
        createdByActorId: 'creator-1',
        dependsOnIds: ['missing-task'],
      }),
    ).rejects.toThrow('One or more dependency tasks not found');

    expect(tagWriter.findOrCreate).not.toHaveBeenCalled();
    expect(outboxWriter.enqueue).not.toHaveBeenCalled();
  });
});
