jest.mock('@taico/errors', () => ({
  ErrorCodes: { THREAD_NOT_FOUND: 'THREAD_NOT_FOUND' },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../thread.entity';
import { DeleteThreadUseCase } from './delete-thread.use-case';
import { UpdateThreadUseCase } from './update-thread.use-case';

describe('Thread mutation use cases', () => {
  function setup() {
    const thread = Object.assign(new ThreadEntity(), {
      id: 'thread-1',
      title: 'Before',
      createdByActorId: 'actor-1',
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(thread);
    const save = jest.spyOn(repository, 'save').mockResolvedValue(thread);
    const softRemove = jest
      .spyOn(repository, 'softRemove')
      .mockResolvedValue(thread);
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
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    return {
      thread,
      manager,
      dataSource,
      outboxWriter,
      save,
      softRemove,
      enqueue,
    };
  }

  it('updates a thread and enqueues the update in the same transaction', async () => {
    const { thread, manager, dataSource, outboxWriter, save, enqueue } =
      setup();
    const useCase = new UpdateThreadUseCase(dataSource, outboxWriter);

    await useCase.execute(thread.id, { title: 'After' }, 'actor-1');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'After' }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.THREAD_UPDATED,
        payload: { threadId: thread.id, actorId: 'actor-1' },
      }),
    );
  });

  it('soft-deletes a thread and enqueues deletion in the same transaction', async () => {
    const { thread, manager, dataSource, outboxWriter, softRemove, enqueue } =
      setup();
    const useCase = new DeleteThreadUseCase(dataSource, outboxWriter);

    await useCase.execute(thread.id, 'actor-1');

    expect(softRemove).toHaveBeenCalledWith(thread);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.THREAD_DELETED,
        payload: { threadId: thread.id, actorId: 'actor-1' },
      }),
    );
  });
});
