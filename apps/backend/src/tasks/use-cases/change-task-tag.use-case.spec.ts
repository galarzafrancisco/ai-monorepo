jest.mock('@taico/errors', () => ({
  ErrorCodes: { TASK_NOT_FOUND: 'TASK_NOT_FOUND' },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { TaskStatus } from '../enums';
import { TaskEntity } from '../task.entity';
import { ChangeTaskTagUseCase } from './change-task-tag.use-case';

describe('ChangeTaskTagUseCase', () => {
  function makeTask(tagList: TagEntity[] = []): TaskEntity {
    return Object.assign(new TaskEntity(), {
      id: 'task-1',
      name: 'Task',
      description: 'Description',
      status: TaskStatus.NOT_STARTED,
      assigneeActorId: null,
      createdByActorId: 'actor-1',
      sessionId: null,
      comments: [],
      artefacts: [],
      inputRequests: [],
      tags: tagList,
      dependsOn: [],
    });
  }

  function createUseCase(tagList: TagEntity[] = []) {
    const task = makeTask(tagList);
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockImplementation(async () => task);
    const save = jest.spyOn(taskRepository, 'save').mockResolvedValue(task);
    const tagRepository = Object.create(
      Repository.prototype,
    ) as Repository<TagEntity>;
    jest.spyOn(tagRepository, 'findOne').mockResolvedValue(tagList[0] ?? null);
    const removeTag = jest.spyOn(tagRepository, 'delete').mockResolvedValue({
      raw: [],
      affected: 1,
    });
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof TaskEntity | typeof TagEntity) =>
        entity === TaskEntity ? taskRepository : tagRepository,
    });
    const query = jest
      .spyOn(manager, 'query')
      .mockResolvedValue([
        { count: 0 },
        { count: 0 },
        { count: 0 },
        { count: 0 },
      ]);
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const tagWriter = Object.create(
      TransactionalTagWriterService.prototype,
    ) as TransactionalTagWriterService;
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'feature',
    });
    const findOrCreate = jest
      .spyOn(tagWriter, 'findOrCreate')
      .mockResolvedValue([tag]);
    const incrementUsage = jest.spyOn(tagWriter, 'incrementUsage');
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    return {
      useCase: new ChangeTaskTagUseCase(dataSource, tagWriter, outboxWriter),
      task,
      manager,
      save,
      query,
      removeTag,
      findOrCreate,
      incrementUsage,
      enqueue,
      tag,
    };
  }

  it('creates, attaches, counts usage, and notifies within one transaction', async () => {
    const {
      useCase,
      task,
      manager,
      save,
      findOrCreate,
      incrementUsage,
      enqueue,
      tag,
    } = createUseCase();

    await useCase.add(task.id, 'feature', 'actor-1');

    expect(findOrCreate).toHaveBeenCalledWith(manager, ['feature']);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [expect.objectContaining({ id: tag.id })],
      }),
    );
    expect(incrementUsage).toHaveBeenCalledWith(manager, [tag.id]);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ type: OutboxEventTypes.TASK_UPDATED }),
    );
  });

  it('keeps a removed tag when another aggregate still references it', async () => {
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'feature',
    });
    const { useCase, task, query, removeTag } = createUseCase([tag]);
    query.mockResolvedValue([
      { count: 0 },
      { count: 1 },
      { count: 0 },
      { count: 0 },
    ]);

    await useCase.remove(task.id, tag.id, 'actor-1');

    expect(removeTag).not.toHaveBeenCalled();
  });
});
