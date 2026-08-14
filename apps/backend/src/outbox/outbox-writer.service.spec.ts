import { EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';
import { OutboxWriterService } from './outbox-writer.service';

describe('OutboxWriterService', () => {
  it('writes a serializable event through the caller transaction manager', async () => {
    const repository: Repository<OutboxEventEntity> = Object.create(
      Repository.prototype,
    );
    const create = jest
      .spyOn(repository, 'create')
      .mockImplementation((event) => event as OutboxEventEntity);
    const save = jest
      .spyOn(repository, 'save')
      .mockImplementation(async (event) => event as OutboxEventEntity);
    const manager: EntityManager = Object.create(EntityManager.prototype);
    const getRepository = jest
      .spyOn(manager, 'getRepository')
      .mockReturnValue(repository);
    const writer = new OutboxWriterService();

    await writer.enqueue(manager, {
      type: 'tasks.status-changed.v1',
      actorId: 'actor-1',
      aggregateType: 'task',
      aggregateId: 'task-1',
      payload: { taskId: 'task-1', actorId: 'actor-1' },
    });

    expect(getRepository).toHaveBeenCalledWith(OutboxEventEntity);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks.status-changed.v1',
        actorId: 'actor-1',
        aggregateType: 'task',
        aggregateId: 'task-1',
        processedAt: null,
        processingStartedAt: null,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });
});
