jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { TaskEntity } from '../../tasks/task.entity';
import { ThreadEntity } from '../thread.entity';
import { ChangeThreadTaskUseCase } from './change-thread-task.use-case';

describe('ChangeThreadTaskUseCase', () => {
  it('attaches a task and its assignee participant in one transaction', async () => {
    const assignee = Object.assign(new ActorEntity(), { id: 'actor-1' });
    const task = Object.assign(new TaskEntity(), {
      id: 'task-1',
      assigneeActorId: assignee.id,
    });
    const thread = Object.assign(new ThreadEntity(), {
      id: 'thread-1',
      createdByActorId: 'creator-1',
      tasks: [],
      participants: [],
    });
    const threadRepository = Object.create(
      Repository.prototype,
    ) as Repository<ThreadEntity>;
    jest.spyOn(threadRepository, 'findOne').mockResolvedValue(thread);
    const save = jest.spyOn(threadRepository, 'save').mockResolvedValue(thread);
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    jest.spyOn(actorRepository, 'findOne').mockResolvedValue(assignee);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (
        entity: typeof ThreadEntity | typeof TaskEntity | typeof ActorEntity,
      ) => {
        if (entity === ThreadEntity) return threadRepository;
        if (entity === TaskEntity) return taskRepository;
        return actorRepository;
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
    const useCase = new ChangeThreadTaskUseCase(dataSource, outboxWriter);

    await useCase.attach(thread.id, task.id);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ tasks: [task], participants: [assignee] }),
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
