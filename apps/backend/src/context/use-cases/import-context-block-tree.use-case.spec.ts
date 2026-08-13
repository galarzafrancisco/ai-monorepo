jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { ImportContextBlockTreeUseCase } from './import-context-block-tree.use-case';

describe('ImportContextBlockTreeUseCase', () => {
  it('creates the complete parent-child tree and durable events in one transaction', async () => {
    const root = Object.assign(new ContextBlockEntity(), { id: 'root-1' });
    const child = Object.assign(new ContextBlockEntity(), { id: 'child-1' });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest
      .spyOn(repository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ContextBlockEntity(), input),
      );
    jest
      .spyOn(repository, 'save')
      .mockResolvedValueOnce(root)
      .mockResolvedValueOnce(child);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: () => repository,
    });
    Object.defineProperty(manager, 'query', {
      value: jest.fn().mockResolvedValue([{ nextOrder: 0 }]),
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    const transaction = jest.fn(
      async (
        callback: (transactionManager: EntityManager) => Promise<unknown>,
      ) => callback(manager),
    );
    Object.defineProperty(dataSource, 'transaction', { value: transaction });
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new ImportContextBlockTreeUseCase(dataSource, outboxWriter);

    const count = await useCase.execute(
      [
        { title: 'Root', content: 'root', parentEntryIndex: null },
        { title: 'Child', content: 'child', parentEntryIndex: 0 },
      ],
      'actor-1',
    );

    expect(count).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ parentId: root.id }),
    );
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenLastCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_CREATED,
        aggregateId: child.id,
      }),
    );
  });
});
