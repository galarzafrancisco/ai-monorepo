jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ContextBlockEntity } from '../../context/block.entity';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ActorService } from '../../identity-provider/actor.service';
import { TagEntity } from '../../meta/tag.entity';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../../threads/thread.entity';
import { TaskEntity } from '../task.entity';
import { CreateTaskInThreadUseCase } from './create-task-in-thread.use-case';

describe('CreateTaskInThreadUseCase', () => {
  it('creates the child task and a missing parent thread in one transaction', async () => {
    const actor = Object.assign(new ActorEntity(), { id: 'actor-1' });
    const parentTask = Object.assign(new TaskEntity(), {
      id: 'parent-task-1',
      name: 'Parent',
      description: 'Parent task',
    });
    const childTask = Object.assign(new TaskEntity(), {
      id: 'child-task-1',
      tags: [],
      comments: [],
      artefacts: [],
      inputRequests: [],
      dependsOn: [],
      assigneeActor: actor,
      createdByActor: actor,
    });
    const stateTag = Object.assign(new TagEntity(), {
      id: 'state-tag-1',
      name: 'thread:state',
    });
    const stateBlock = Object.assign(new ContextBlockEntity(), {
      id: 'state-block-1',
    });
    const thread = Object.assign(new ThreadEntity(), { id: 'thread-1' });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest
      .spyOn(taskRepository, 'findOne')
      .mockResolvedValueOnce(parentTask)
      .mockResolvedValueOnce(childTask);
    jest.spyOn(taskRepository, 'findBy').mockResolvedValue([]);
    jest
      .spyOn(taskRepository, 'create')
      .mockImplementation((input) => Object.assign(new TaskEntity(), input));
    jest.spyOn(taskRepository, 'save').mockResolvedValue(childTask);
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(threadRepository, 'findOne').mockResolvedValue(null);
    jest
      .spyOn(threadRepository, 'create')
      .mockImplementation((input) => Object.assign(new ThreadEntity(), input));
    jest.spyOn(threadRepository, 'save').mockResolvedValue(thread);
    const blockRepository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest
      .spyOn(blockRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ContextBlockEntity(), input),
      );
    jest.spyOn(blockRepository, 'save').mockResolvedValue(stateBlock);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) => {
        if (entity === TaskEntity) return taskRepository;
        if (entity === ThreadEntity) return threadRepository;
        return blockRepository;
      },
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const actorService = Object.create(ActorService.prototype) as ActorService;
    jest.spyOn(actorService, 'getActorByIdOrSlug').mockResolvedValue(actor);
    const tagWriter = Object.create(
      TransactionalTagWriterService.prototype,
    ) as TransactionalTagWriterService;
    jest.spyOn(tagWriter, 'findOrCreate').mockResolvedValueOnce([stateTag]);
    jest.spyOn(tagWriter, 'incrementUsage').mockResolvedValue();
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new CreateTaskInThreadUseCase(
      dataSource,
      actorService,
      tagWriter,
      outboxWriter,
    );

    await useCase.execute(
      {
        name: 'Child',
        description: 'Child task',
        createdByActorId: actor.id,
      },
      parentTask.id,
    );

    expect(threadRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ tasks: [parentTask, childTask] }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ type: OutboxEventTypes.THREAD_CREATED }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ type: OutboxEventTypes.TASK_CREATED }),
    );
  });
});
