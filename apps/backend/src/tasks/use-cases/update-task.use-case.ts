import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ActorService } from '../../identity-provider/actor.service';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { UpdateTaskInput } from '../dto/service/tasks.service.types';
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

/** Owns atomic edits to a task and its task/tag/dependency relations. */
@Injectable()
export class UpdateTaskUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly actorService: ActorService,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    taskId: string,
    input: UpdateTaskInput,
    actorId: string,
  ): Promise<TaskEntity> {
    const assigneeInput: string | null | undefined = input.assigneeActorId;
    const assignee = assigneeInput
      ? await this.actorService.getActorByIdOrSlug(assigneeInput)
      : null;

    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const task = await taskRepository.findOne({
        where: { id: taskId },
        relations: [...TASK_RELATIONS],
      });
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      if (input.name !== undefined) task.name = input.name;
      if (input.description !== undefined) task.description = input.description;
      if (input.sessionId !== undefined)
        task.sessionId = input.sessionId ?? null;
      if (assigneeInput !== undefined) {
        if (assigneeInput === null) {
          task.assigneeActorId = null;
          task.assigneeActor = undefined;
        } else if (assignee) {
          task.assigneeActorId = assignee.id;
          task.assigneeActor = undefined;
        }
      }

      if (input.tagNames !== undefined) {
        task.tags = input.tagNames.length
          ? await this.tagWriter.findOrCreate(manager, input.tagNames)
          : [];
      }

      if (input.dependsOnIds !== undefined) {
        const dependencies = input.dependsOnIds.length
          ? await taskRepository.findBy({ id: In(input.dependsOnIds) })
          : [];
        if (dependencies.length !== input.dependsOnIds.length) {
          throw new Error('One or more dependency tasks not found');
        }
        task.dependsOn = dependencies;
      }

      await taskRepository.save(task);
      const taskWithRelations = await taskRepository.findOne({
        where: { id: taskId },
        relations: [...TASK_RELATIONS],
      });
      if (!taskWithRelations) {
        throw new TaskNotFoundError(taskId);
      }

      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_UPDATED,
        actorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: { taskId, actorId },
      });
      return taskWithRelations;
    });
  }
}
