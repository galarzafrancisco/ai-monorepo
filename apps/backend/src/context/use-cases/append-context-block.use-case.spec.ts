jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { AppendContextBlockUseCase } from './append-context-block.use-case';

describe('AppendContextBlockUseCase', () => {
  it('uses an atomic SQL append and records the update in the transaction', async () => {
    const block = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
      content: 'Before\nAfter',
      createdByActorId: 'actor-1',
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(block);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    jest.spyOn(manager, 'query').mockResolvedValue({ changes: 1 });
    jest.spyOn(manager, 'getRepository').mockReturnValue(repository);
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
    const useCase = new AppendContextBlockUseCase(dataSource, outboxWriter);

    await useCase.execute(block.id, { content: 'After' });

    expect(manager.query).toHaveBeenCalledWith(
      'UPDATE context_blocks SET content = content || ? WHERE id = ?',
      ['\nAfter', block.id],
    );
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
        payload: { blockId: block.id, actorId: block.createdByActorId },
      }),
    );
  });
});
