import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AssignTaskInput } from '../dto/service/tasks.service.types';
import { TaskNotFoundError } from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';

const TASK_RELATIONS = [
  'comments',
  'comments.commenterActor',
  'artefacts',
  'inputRequests',
  'tags',
  'dependsOn',
  'assigneeActor',
  'createdByActor',
] as const;

/** Owns assignment and its durable post-commit notification. */
@Injectable()
export class AssignTaskUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    taskId: string,
    input: AssignTaskInput,
    actorId: string,
  ): Promise<TaskEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const task = await taskRepository.findOne({
        where: { id: taskId },
        relations: [...TASK_RELATIONS],
      });
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }
      if (task.assigneeActorId === input.assigneeActorId) {
        return task;
      }

      task.assigneeActorId = input.assigneeActorId;
      task.assigneeActor = undefined;
      if (input.sessionId !== undefined) {
        task.sessionId = input.sessionId || null;
      }
      await taskRepository.save(task);

      const assignedTask = await taskRepository.findOne({
        where: { id: taskId },
        relations: [...TASK_RELATIONS],
      });
      if (!assignedTask) {
        throw new TaskNotFoundError(taskId);
      }

      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_ASSIGNED,
        actorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: { taskId, actorId },
      });
      return assignedTask;
    });
  }
}
