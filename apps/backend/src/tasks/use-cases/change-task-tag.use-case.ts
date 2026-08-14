import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
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

@Injectable()
export class ChangeTaskTagUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async add(
    taskId: string,
    tagName: string,
    actorId: string,
  ): Promise<TaskEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const task = await this.loadTask(taskRepository, taskId);
      const [tag] = await this.tagWriter.findOrCreate(manager, [tagName]);
      if (!tag) throw new Error('A tag name is required');
      if (!task.tags.some((existing) => existing.id === tag.id)) {
        task.tags.push(tag);
        await taskRepository.save(task);
        await this.tagWriter.incrementUsage(manager, [tag.id]);
      }
      const updated = await this.loadTask(taskRepository, taskId);
      await this.enqueueUpdate(manager, taskId, actorId);
      return updated;
    });
  }

  async remove(
    taskId: string,
    tagId: string,
    actorId: string,
  ): Promise<TaskEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const task = await this.loadTask(taskRepository, taskId);
      const wasAttached = task.tags.some((tag) => tag.id === tagId);
      if (wasAttached) {
        task.tags = task.tags.filter((tag) => tag.id !== tagId);
        await taskRepository.save(task);
        await this.tagWriter.cleanupOrphaned(manager, tagId);
      }
      const updated = await this.loadTask(taskRepository, taskId);
      await this.enqueueUpdate(manager, taskId, actorId);
      return updated;
    });
  }

  private async loadTask(
    repository: Repository<TaskEntity>,
    taskId: string,
  ): Promise<TaskEntity> {
    const task = await repository.findOne({
      where: { id: taskId },
      relations: [...TASK_RELATIONS],
    });
    if (!task) throw new TaskNotFoundError(taskId);
    return task;
  }

  private async enqueueUpdate(
    manager: EntityManager,
    taskId: string,
    actorId: string,
  ): Promise<void> {
    await this.outboxWriter.enqueue(manager, {
      type: OutboxEventTypes.TASK_UPDATED,
      actorId,
      aggregateType: 'task',
      aggregateId: taskId,
      payload: { taskId, actorId },
    });
  }
}
