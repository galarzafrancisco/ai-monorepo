jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ContextBlockEntity } from '../../context/block.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../thread.entity';
import { ChangeThreadRelationsUseCase } from './change-thread-relations.use-case';

describe('ChangeThreadRelationsUseCase', () => {
  it('references a context block and records the update in one transaction', async () => {
    const block = Object.assign(new ContextBlockEntity(), { id: 'block-1' });
    const thread = Object.assign(new ThreadEntity(), {
      id: 'thread-1',
      createdByActorId: 'actor-1',
      referencedContextBlocks: [],
    });
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(threadRepository, 'findOne').mockResolvedValue(thread);
    const save = jest.spyOn(threadRepository, 'save').mockResolvedValue(thread);
    const blockRepository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest.spyOn(blockRepository, 'findOne').mockResolvedValue(block);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof ThreadEntity | typeof ContextBlockEntity) =>
        entity === ThreadEntity ? threadRepository : blockRepository,
    });
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
    const useCase = new ChangeThreadRelationsUseCase(dataSource, outboxWriter);

    await useCase.referenceContextBlock(thread.id, block.id);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ referencedContextBlocks: [block] }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.THREAD_UPDATED,
        payload: { threadId: thread.id, actorId: thread.createdByActorId },
      }),
    );
  });
});
