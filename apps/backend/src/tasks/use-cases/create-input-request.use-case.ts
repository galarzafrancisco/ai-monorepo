import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { CreateInputRequestInput } from '../dto/service/tasks.service.types';
import {
  ActorNotFoundError,
  InputRequestSelfAssignmentError,
  TaskNotFoundError,
} from '../errors/tasks.errors';
import { InputRequestEntity } from '../input-request.entity';
import { TaskEntity } from '../task.entity';

@Injectable()
export class CreateInputRequestUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(input: CreateInputRequestInput): Promise<InputRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const actorRepository = manager.getRepository(ActorEntity);
      const inputRequestRepository = manager.getRepository(InputRequestEntity);
      const task = await taskRepository.findOne({
        where: { id: input.taskId },
      });
      if (!task) throw new TaskNotFoundError(input.taskId);

      const assignedToActorId =
        input.assignedToActorId ?? task.createdByActorId;
      if (input.askedByActorId === assignedToActorId) {
        throw new InputRequestSelfAssignmentError(
          input.askedByActorId,
          assignedToActorId,
        );
      }
      const [askedBy, assignedTo] = await Promise.all([
        actorRepository.findOne({ where: { id: input.askedByActorId } }),
        actorRepository.findOne({ where: { id: assignedToActorId } }),
      ]);
      if (!askedBy) throw new ActorNotFoundError(input.askedByActorId);
      if (!assignedTo) throw new ActorNotFoundError(assignedToActorId);

      const saved = await inputRequestRepository.save(
        inputRequestRepository.create({
          taskId: input.taskId,
          askedByActorId: input.askedByActorId,
          assignedToActorId,
          question: input.question,
          answer: null,
          resolvedAt: null,
        }),
      );
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_UPDATED,
        actorId: input.askedByActorId,
        aggregateType: 'task',
        aggregateId: input.taskId,
        payload: { taskId: input.taskId, actorId: input.askedByActorId },
      });
      return saved;
    });
  }
}
