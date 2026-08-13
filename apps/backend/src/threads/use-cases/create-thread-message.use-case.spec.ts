jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../thread.entity';
import { ThreadMessageEntity } from '../thread-message.entity';
import { CreateThreadMessageUseCase } from './create-thread-message.use-case';

describe('CreateThreadMessageUseCase', () => {
  it('persists a message and its durable notification using one transaction', async () => {
    const thread = Object.assign(new ThreadEntity(), { id: 'thread-1' });
    const actor = Object.assign(new ActorEntity(), { id: 'actor-1' });
    const message = Object.assign(new ThreadMessageEntity(), {
      id: 'message-1',
      threadId: thread.id,
      createdByActorId: actor.id,
      createdByActor: actor,
    });
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(threadRepository, 'findOne').mockResolvedValue(thread);
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    jest.spyOn(actorRepository, 'findOne').mockResolvedValue(actor);
    const messageRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadMessageEntity>;
    jest.spyOn(messageRepository, 'count').mockResolvedValue(0);
    jest
      .spyOn(messageRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ThreadMessageEntity(), input),
      );
    jest.spyOn(messageRepository, 'save').mockResolvedValue(message);
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue(message);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) => {
        if (entity === ThreadEntity) return threadRepository;
        if (entity === ActorEntity) return actorRepository;
        return messageRepository;
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
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new CreateThreadMessageUseCase(dataSource, outboxWriter);

    await useCase.execute({
      threadId: thread.id,
      content: 'Hello',
      createdByActorId: actor.id,
    });

    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.THREAD_MESSAGE_CREATED,
        aggregateId: message.id,
      }),
    );
  });
});
