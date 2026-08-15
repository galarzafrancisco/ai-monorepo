import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxEventEntity } from './outbox-event.entity';

describe('OutboxDispatcherService', () => {
  function createEvent(): OutboxEventEntity {
    return Object.assign(new OutboxEventEntity(), {
      id: 'event-1',
      type: 'tasks.status-changed.v1',
      version: 1,
      actorId: 'actor-1',
      aggregateType: 'task',
      aggregateId: 'task-1',
      payload: { taskId: 'task-1', actorId: 'actor-1' },
      occurredAt: new Date('2026-08-11T00:00:00.000Z'),
      availableAt: new Date('2026-08-11T00:00:00.000Z'),
      attempts: 1,
      processingStartedAt: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date('2026-08-11T00:00:00.000Z'),
      updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    });
  }

  it('claims, dispatches, and marks an event processed', async () => {
    const event = createEvent();
    const selectBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce(null),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(selectBuilder),
      findOne: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as Pick<
      Repository<OutboxEventEntity>,
      'createQueryBuilder' | 'findOne' | 'update'
    >;
    const eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([undefined]),
    } as Pick<EventEmitter2, 'emitAsync'>;
    const dispatcher = new OutboxDispatcherService(
      repository as Repository<OutboxEventEntity>,
      eventEmitter as EventEmitter2,
    );

    await dispatcher.dispatchAvailableEvents();

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(event.type, event);
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: event.id }),
      expect.objectContaining({ processedAt: expect.any(Date) }),
    );
  });

  it('retries an event when no handler is registered', async () => {
    const event = createEvent();
    const selectBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce(null),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(selectBuilder),
      findOne: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as Pick<
      Repository<OutboxEventEntity>,
      'createQueryBuilder' | 'findOne' | 'update'
    >;
    const eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as Pick<EventEmitter2, 'emitAsync'>;
    const dispatcher = new OutboxDispatcherService(
      repository as Repository<OutboxEventEntity>,
      eventEmitter as EventEmitter2,
    );

    await dispatcher.dispatchAvailableEvents();

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: event.id }),
      expect.objectContaining({
        processingStartedAt: null,
        availableAt: expect.any(Date),
      }),
    );
  });

  it('retains retry state when a durable task listener rejects', async () => {
    const event = createEvent();
    const selectBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce(null),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(selectBuilder),
      findOne: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as Pick<
      Repository<OutboxEventEntity>,
      'createQueryBuilder' | 'findOne' | 'update'
    >;
    const eventEmitter = {
      emitAsync: jest
        .fn()
        .mockRejectedValue(new Error('readiness reconciliation failed')),
    } as Pick<EventEmitter2, 'emitAsync'>;
    const dispatcher = new OutboxDispatcherService(
      repository as Repository<OutboxEventEntity>,
      eventEmitter as EventEmitter2,
    );

    await dispatcher.dispatchAvailableEvents();

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: event.id }),
      expect.objectContaining({
        processingStartedAt: null,
        availableAt: expect.any(Date),
        lastError: 'readiness reconciliation failed',
      }),
    );
    expect(repository.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ processedAt: expect.any(Date) }),
    );
  });
});
