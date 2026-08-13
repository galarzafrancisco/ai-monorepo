jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    INPUT_REQUEST_SELF_ASSIGNMENT: 'INPUT_REQUEST_SELF_ASSIGNMENT',
  },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { InputRequestEntity } from '../input-request.entity';
import { TaskEntity } from '../task.entity';
import { AnswerInputRequestUseCase } from './answer-input-request.use-case';
import { CreateInputRequestUseCase } from './create-input-request.use-case';

describe('Input request use cases', () => {
  function transactionManager() {
    const manager = Object.create(EntityManager.prototype) as EntityManager;
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
    return { manager, dataSource, outboxWriter, enqueue };
  }

  it('creates a request only after validating both actors in the same transaction', async () => {
    const { manager, dataSource, outboxWriter, enqueue } = transactionManager();
    const task = Object.assign(new TaskEntity(), {
      id: 'task-1',
      createdByActorId: 'assigned-1',
    });
    const askedBy = Object.assign(new ActorEntity(), { id: 'asked-1' });
    const assignedTo = Object.assign(new ActorEntity(), { id: 'assigned-1' });
    const request = Object.assign(new InputRequestEntity(), {
      id: 'request-1',
      taskId: task.id,
      askedByActorId: askedBy.id,
      assignedToActorId: assignedTo.id,
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    jest
      .spyOn(actorRepository, 'findOne')
      .mockResolvedValueOnce(askedBy)
      .mockResolvedValueOnce(assignedTo);
    const requestRepository = Object.create(
      Repository.prototype,
    ) as Repository<InputRequestEntity>;
    jest
      .spyOn(requestRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new InputRequestEntity(), input),
      );
    jest.spyOn(requestRepository, 'save').mockResolvedValue(request);
    Object.defineProperty(manager, 'getRepository', {
      value: (
        entity:
          | typeof TaskEntity
          | typeof ActorEntity
          | typeof InputRequestEntity,
      ) => {
        if (entity === TaskEntity) return taskRepository;
        if (entity === ActorEntity) return actorRepository;
        return requestRepository;
      },
    });

    const useCase = new CreateInputRequestUseCase(dataSource, outboxWriter);
    await useCase.execute({
      taskId: task.id,
      askedByActorId: askedBy.id,
      question: 'Can you clarify?',
    });

    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_UPDATED,
        payload: { taskId: task.id, actorId: askedBy.id },
      }),
    );
  });

  it('answers a request and records a durable answer event in one transaction', async () => {
    const { manager, dataSource, outboxWriter, enqueue } = transactionManager();
    const request = Object.assign(new InputRequestEntity(), {
      id: 'request-1',
      taskId: 'task-1',
      answer: null,
      resolvedAt: null,
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<InputRequestEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(request);
    jest.spyOn(repository, 'save').mockResolvedValue(request);
    Object.defineProperty(manager, 'getRepository', {
      value: () => repository,
    });

    const useCase = new AnswerInputRequestUseCase(dataSource, outboxWriter);
    await useCase.execute(
      request.taskId,
      request.id,
      { answer: 'Yes.' },
      'actor-1',
    );

    expect(request.answer).toBe('Yes.');
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_INPUT_REQUEST_ANSWERED,
        payload: {
          taskId: request.taskId,
          inputRequestId: request.id,
          actorId: 'actor-1',
        },
      }),
    );
  });
});
