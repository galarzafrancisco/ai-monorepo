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
  it('re-emits a created task only when the outbox dispatcher delivers it', async () => {
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
    const emit = jest.spyOn(eventEmitter, 'emit');
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

    expect(emit).toHaveBeenCalledWith(
      TaskCreatedEvent.INTERNAL,
      expect.objectContaining({
        actor: { id: 'actor-1' },
        payload: task,
      }),
    );
  });
});
