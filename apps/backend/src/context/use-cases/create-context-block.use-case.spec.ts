jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { CreateContextBlockUseCase } from './create-context-block.use-case';

describe('CreateContextBlockUseCase', () => {
  it('creates the block, its tags, usage counter, and event with one manager', async () => {
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'feature',
    });
    const block = Object.assign(new ContextBlockEntity(), {
      id: 'block-1',
      title: 'Design',
      createdByActorId: 'actor-1',
      tags: [tag],
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ContextBlockEntity>;
    jest
      .spyOn(repository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ContextBlockEntity(), input),
      );
    jest.spyOn(repository, 'save').mockResolvedValue(block);
    jest.spyOn(repository, 'findOne').mockResolvedValue(block);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    jest.spyOn(manager, 'getRepository').mockReturnValue(repository);
    jest.spyOn(manager, 'query').mockResolvedValue([{ nextOrder: 2 }]);
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
    const useCase = new CreateContextBlockUseCase(
      dataSource,
      tagWriter,
      outboxWriter,
    );

    await useCase.execute({
      title: block.title,
      content: 'Content',
      createdByActorId: block.createdByActorId,
      parentId: null,
      tagNames: [tag.name],
    });

    expect(findOrCreate).toHaveBeenCalledWith(manager, [tag.name]);
    expect(incrementUsage).toHaveBeenCalledWith(manager, [tag.id]);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.CONTEXT_BLOCK_CREATED,
        payload: { blockId: block.id, actorId: block.createdByActorId },
      }),
    );
  });
});
