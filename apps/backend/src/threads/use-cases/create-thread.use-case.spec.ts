jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ContextBlockEntity } from '../../context/block.entity';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { TaskEntity } from '../../tasks/task.entity';
import { ThreadEntity } from '../thread.entity';
import { CreateThreadUseCase } from './create-thread.use-case';

describe('CreateThreadUseCase', () => {
  it('writes the state block, relation joins, tag usage, thread, and outbox event together', async () => {
    const creator = Object.assign(new ActorEntity(), {
      id: 'actor-1',
      slug: 'creator',
    });
    const task = Object.assign(new TaskEntity(), { id: 'task-1' });
    const referencedBlock = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
    });
    const stateBlock = Object.assign(new ContextBlockEntity(), {
      id: 'state-block-1',
    });
    const stateTag = Object.assign(new TagEntity(), {
      id: 'state-tag-1',
      name: 'thread:state',
    });
    const threadTag = Object.assign(new TagEntity(), {
      id: 'thread-tag-1',
      name: 'project:taico',
    });
    const thread = Object.assign(new ThreadEntity(), {
      id: 'thread-1',
      title: 'Thread',
      createdByActorId: creator.id,
      stateContextBlockId: stateBlock.id,
    });
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    jest.spyOn(actorRepository, 'findOne').mockResolvedValue(creator);
    jest.spyOn(actorRepository, 'findBy').mockResolvedValue([creator]);
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findBy').mockResolvedValue([task]);
    const blockRepository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest
      .spyOn(blockRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ContextBlockEntity(), input),
      );
    jest.spyOn(blockRepository, 'save').mockResolvedValue(stateBlock);
    jest.spyOn(blockRepository, 'findBy').mockResolvedValue([referencedBlock]);
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    const createThread = jest
      .spyOn(threadRepository, 'create')
      .mockImplementation((input) => Object.assign(new ThreadEntity(), input));
    jest.spyOn(threadRepository, 'save').mockResolvedValue(thread);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (
        entity:
          | typeof ActorEntity
          | typeof TaskEntity
          | typeof ContextBlockEntity
          | typeof ThreadEntity,
      ) => {
        if (entity === ActorEntity) return actorRepository;
        if (entity === TaskEntity) return taskRepository;
        if (entity === ContextBlockEntity) return blockRepository;
        return threadRepository;
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
    const tagWriter = Object.create(
      TransactionalTagWriterService.prototype,
    ) as TransactionalTagWriterService;
    const findOrCreate = jest
      .spyOn(tagWriter, 'findOrCreate')
      .mockResolvedValueOnce([stateTag])
      .mockResolvedValueOnce([threadTag]);
    const incrementUsage = jest
      .spyOn(tagWriter, 'incrementUsage')
      .mockResolvedValue();
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new CreateThreadUseCase(
      dataSource,
      tagWriter,
      outboxWriter,
    );

    await useCase.execute({
      title: 'Thread',
      createdByActorId: creator.id,
      taskIds: [task.id],
      contextBlockIds: [referencedBlock.id],
      participantActorIds: [creator.id],
      tagNames: [threadTag.name],
    });

    expect(findOrCreate).toHaveBeenNthCalledWith(1, manager, ['thread:state']);
    expect(findOrCreate).toHaveBeenNthCalledWith(2, manager, [threadTag.name]);
    expect(createThread).toHaveBeenCalledWith(
      expect.objectContaining({
        stateContextBlockId: stateBlock.id,
        tasks: [task],
        referencedContextBlocks: [referencedBlock],
        participants: [creator],
        tags: [threadTag],
      }),
    );
    expect(incrementUsage).toHaveBeenCalledWith(manager, [
      stateTag.id,
      threadTag.id,
    ]);
    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_CREATED,
        aggregateId: stateBlock.id,
        payload: { blockId: stateBlock.id, actorId: creator.id },
      }),
    );
    expect(enqueue).toHaveBeenNthCalledWith(
      2,
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.THREAD_CREATED,
        payload: { threadId: thread.id, actorId: creator.id },
      }),
    );
  });
});
