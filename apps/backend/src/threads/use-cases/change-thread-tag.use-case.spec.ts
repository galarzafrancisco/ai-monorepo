jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { TagEntity } from '../../meta/tag.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../thread.entity';
import { ChangeThreadTagUseCase } from './change-thread-tag.use-case';

describe('ChangeThreadTagUseCase', () => {
  it('attaches tags, counts usage, and records the update in one transaction', async () => {
    const thread = Object.assign(new ThreadEntity(), {
      id: 'thread-1',
      tags: [],
    });
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'feature',
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(thread);
    const save = jest.spyOn(repository, 'save').mockResolvedValue(thread);
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
    const useCase = new ChangeThreadTagUseCase(
      dataSource,
      tagWriter,
      outboxWriter,
    );

    await useCase.add(thread.id, tag.name, 'actor-1');

    expect(findOrCreate).toHaveBeenCalledWith(manager, [tag.name]);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [expect.objectContaining({ id: tag.id })],
      }),
    );
    expect(incrementUsage).toHaveBeenCalledWith(manager, [tag.id]);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.THREAD_UPDATED,
        payload: { threadId: thread.id, actorId: 'actor-1' },
      }),
    );
  });
});
