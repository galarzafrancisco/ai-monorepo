jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../../threads/thread.entity';
import { ContextBlockEntity } from '../block.entity';
import { BlockIsThreadStateError } from '../errors/context.errors';
import { DeleteContextBlockUseCase } from './delete-context-block.use-case';

describe('DeleteContextBlockUseCase', () => {
  it('checks children and thread state, deletes, and enqueues in one transaction', async () => {
    const block = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
      createdByActorId: 'actor-1',
    });
    const blockRepository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest.spyOn(blockRepository, 'findOne').mockResolvedValue(block);
    const count = jest.spyOn(blockRepository, 'count').mockResolvedValue(0);
    const remove = jest.spyOn(blockRepository, 'delete').mockResolvedValue({
      raw: [],
      affected: 1,
    });
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(threadRepository, 'count').mockResolvedValue(0);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof ContextBlockEntity | typeof ThreadEntity) =>
        entity === ContextBlockEntity ? blockRepository : threadRepository,
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
    const useCase = new DeleteContextBlockUseCase(dataSource, outboxWriter);

    await useCase.execute(block.id);

    expect(count).toHaveBeenCalledWith({ where: { parentId: block.id } });
    expect(threadRepository.count).toHaveBeenCalledWith({
      where: { stateContextBlockId: block.id },
    });
    expect(remove).toHaveBeenCalledWith(block.id);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_DELETED,
        payload: { blockId: block.id, actorId: block.createdByActorId },
      }),
    );
  });

  it('prevents deletion while an active thread uses the block as state', async () => {
    const block = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
      createdByActorId: 'actor-1',
    });
    const blockRepository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest.spyOn(blockRepository, 'findOne').mockResolvedValue(block);
    jest.spyOn(blockRepository, 'count').mockResolvedValue(0);
    const remove = jest.spyOn(blockRepository, 'delete');
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(threadRepository, 'count').mockResolvedValue(1);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof ContextBlockEntity | typeof ThreadEntity) =>
        entity === ContextBlockEntity ? blockRepository : threadRepository,
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
    const useCase = new DeleteContextBlockUseCase(dataSource, outboxWriter);

    await expect(useCase.execute(block.id)).rejects.toBeInstanceOf(
      BlockIsThreadStateError,
    );

    expect(remove).not.toHaveBeenCalled();
  });
});
