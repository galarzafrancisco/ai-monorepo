import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ActorService } from '../../identity-provider/actor.service';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { CreateTaskInput } from '../dto/service/tasks.service.types';
import { TaskStatus } from '../enums';
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

/** Owns the complete durable task-creation command. */
@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly actorService: ActorService,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(input: CreateTaskInput): Promise<TaskEntity> {
    const [assignee, creator] = await Promise.all([
      input.assigneeActorId
        ? this.actorService.getActorByIdOrSlug(input.assigneeActorId)
        : Promise.resolve(null),
      this.actorService.getActorByIdOrSlug(input.createdByActorId),
    ]);

    if (input.assigneeActorId && !assignee) {
      throw new Error(`Assignee actor not found: ${input.assigneeActorId}`);
    }
    if (!creator) {
      throw new Error(`Creator actor not found: ${input.createdByActorId}`);
    }

    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const dependencies = input.dependsOnIds?.length
        ? await taskRepository.findBy({ id: In(input.dependsOnIds) })
        : [];
      if (dependencies.length !== (input.dependsOnIds?.length ?? 0)) {
        throw new Error('One or more dependency tasks not found');
      }

      const tags = input.tagNames?.length
        ? await this.tagWriter.findOrCreate(manager, input.tagNames)
        : [];
      const task = await taskRepository.save(
        taskRepository.create({
          name: input.name,
          description: input.description,
          assigneeActorId: assignee?.id ?? null,
          sessionId: input.sessionId ?? null,
          status: TaskStatus.NOT_STARTED,
          createdByActorId: creator.id,
          tags,
          dependsOn: dependencies,
        }),
      );

      await this.tagWriter.incrementUsage(
        manager,
        tags.map((tag) => tag.id),
      );

      const taskWithRelations = await taskRepository.findOne({
        where: { id: task.id },
        relations: [...TASK_RELATIONS],
      });
      if (!taskWithRelations) {
        throw new TaskNotFoundError(task.id);
      }

      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_CREATED,
        actorId: creator.id,
        aggregateType: 'task',
        aggregateId: task.id,
        payload: { taskId: task.id, actorId: creator.id },
      });

      return taskWithRelations;
    });
  }
}
