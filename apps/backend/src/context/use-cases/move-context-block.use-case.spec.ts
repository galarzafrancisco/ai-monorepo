jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { MoveContextBlockUseCase } from './move-context-block.use-case';

describe('MoveContextBlockUseCase', () => {
  it('validates, moves, orders, and records the update in one transaction', async () => {
    const block = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
      parentId: null,
      order: 0,
      createdByActorId: 'actor-1',
      tags: [],
    });
    const parent = Object.assign(new ContextBlockEntity(), {
      id: 'parent-1',
      parentId: null,
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest
      .spyOn(repository, 'findOne')
      .mockResolvedValueOnce(block)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(block);
    jest.spyOn(repository, 'save').mockResolvedValue(block);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: () => repository,
    });
    Object.defineProperty(manager, 'query', {
      value: jest.fn().mockResolvedValue([{ maxOrder: 4 }]),
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
    const useCase = new MoveContextBlockUseCase(dataSource, outboxWriter);

    await useCase.execute(block.id, parent.id);

    expect(block.parentId).toBe(parent.id);
    expect(block.order).toBe(5);
    expect(repository.save).toHaveBeenCalledWith(block);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
        aggregateId: block.id,
      }),
    );
  });
});
