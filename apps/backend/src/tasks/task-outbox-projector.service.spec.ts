import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { OutboxEventEntity } from '../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../outbox/outbox-event-types';
import { TaskCreatedEvent } from './events/tasks.events';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { InputRequestEntity } from './input-request.entity';
import { ArtefactEntity } from './artefact.entity';
import { TaskOutboxProjectorService } from './task-outbox-projector.service';

describe('TaskOutboxProjectorService', () => {
  it('awaits a created task relay when the outbox dispatcher delivers it', async () => {
    const task = Object.assign(new TaskEntity(), {
      id: 'task-1',
      createdByActorId: 'actor-1',
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const eventEmitter = Object.create(
      EventEmitter2.prototype,
    ) as EventEmitter2;
    const emitAsync = jest.spyOn(eventEmitter, 'emitAsync').mockResolvedValue([]);
    const service = new TaskOutboxProjectorService(
      taskRepository,
      Object.create(Repository.prototype) as Repository<CommentEntity>,
      Object.create(Repository.prototype) as Repository<InputRequestEntity>,
      Object.create(Repository.prototype) as Repository<ArtefactEntity>,
      eventEmitter,
    );
    const event = Object.assign(new OutboxEventEntity(), {
      type: OutboxEventTypes.TASK_CREATED,
      payload: { taskId: task.id, actorId: 'actor-1' },
    });

    await service.projectCreated(event);

    expect(emitAsync).toHaveBeenCalledWith(
      TaskCreatedEvent.INTERNAL,
      expect.objectContaining({
        actor: { id: 'actor-1' },
        payload: task,
      }),
    );
  });

  it('propagates a readiness reconciliation failure to the outbox dispatcher', async () => {
    const task = Object.assign(new TaskEntity(), {
      id: 'task-1',
      createdByActorId: 'actor-1',
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const eventEmitter = Object.create(
      EventEmitter2.prototype,
    ) as EventEmitter2;
    const failure = new Error('readiness reconciliation failed');
    jest.spyOn(eventEmitter, 'emitAsync').mockRejectedValue(failure);
    const service = new TaskOutboxProjectorService(
      taskRepository,
      Object.create(Repository.prototype) as Repository<CommentEntity>,
      Object.create(Repository.prototype) as Repository<InputRequestEntity>,
      Object.create(Repository.prototype) as Repository<ArtefactEntity>,
      eventEmitter,
    );
    const event = Object.assign(new OutboxEventEntity(), {
      type: OutboxEventTypes.TASK_CREATED,
      payload: { taskId: task.id, actorId: 'actor-1' },
    });

    await expect(service.projectCreated(event)).rejects.toThrow(failure);
  });
});
