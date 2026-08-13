jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { UpdateContextBlockUseCase } from './update-context-block.use-case';

describe('UpdateContextBlockUseCase', () => {
  it('updates fields and tags with the same transaction manager as the event', async () => {
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'feature',
    });
    const block = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
      title: 'Before',
      content: 'Before',
      createdByActorId: 'actor-1',
      tags: [],
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(block);
    const save = jest.spyOn(repository, 'save').mockResolvedValue(block);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    jest.spyOn(manager, 'getRepository').mockReturnValue(repository);
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
      .mockResolvedValue([tag]);
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new UpdateContextBlockUseCase(
      dataSource,
      tagWriter,
      outboxWriter,
    );

    await useCase.execute(block.id, {
      title: 'After',
      tagNames: [tag.name],
      actorId: 'editor-1',
    });

    expect(findOrCreate).toHaveBeenCalledWith(manager, [tag.name]);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'After', tags: [tag] }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
        payload: { blockId: block.id, actorId: 'editor-1' },
      }),
    );
  });
});
