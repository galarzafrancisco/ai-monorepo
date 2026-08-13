import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ThreadEntity } from '../../threads/thread.entity';
import { isSystemTagName } from '../../meta/system-tags';
import { CommentEntity } from '../comment.entity';
import { ChangeStatusInput } from '../dto/service/tasks.service.types';
import { TaskStatus } from '../enums';
import {
  CommentRequiredError,
  InvalidStatusTransitionError,
  TaskNotFoundError,
} from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';

export type ChangeTaskStatusResult = {
  task: TaskEntity;
  autoPruned: boolean;
};

@Injectable()
export class ChangeTaskStatusUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    taskId: string,
    input: ChangeStatusInput,
    actorId: string,
  ): Promise<ChangeTaskStatusResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const commentRepository = manager.getRepository(CommentEntity);
      const task = await taskRepository.findOne({
        where: { id: taskId },
        relations: [
          'comments',
          'comments.commenterActor',
          'artefacts',
          'inputRequests',
          'tags',
          'dependsOn',
          'assigneeActor',
          'createdByActor',
        ],
      });

      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      if (input.status === TaskStatus.IN_PROGRESS && !task.assigneeActorId) {
        throw new InvalidStatusTransitionError(
          task.status,
          input.status,
          'Task must be assigned before moving to in progress',
        );
      }

      if (
        input.status === TaskStatus.DONE &&
        !input.comment &&
        !(task.comments?.length > 0)
      ) {
        throw new CommentRequiredError();
      }

      if (input.status === TaskStatus.DONE && input.comment) {
        await commentRepository.save(
          commentRepository.create({
            task,
            commenterActorId: task.assigneeActorId,
            content: input.comment,
          }),
        );
      }

      task.status = input.status;
      await taskRepository.save(task);

      const updatedTask = await taskRepository.findOne({
        where: { id: taskId },
        relations: [
          'comments',
          'comments.commenterActor',
          'artefacts',
          'inputRequests',
          'tags',
          'dependsOn',
          'assigneeActor',
          'createdByActor',
        ],
      });
      if (!updatedTask) {
        throw new TaskNotFoundError(taskId);
      }

      const shouldAutoPrune =
        updatedTask.status === TaskStatus.DONE &&
        (updatedTask.tags || []).some((tag) => isSystemTagName(tag.name));
      let autoPruned = false;
      if (shouldAutoPrune) {
        const parentThreadCount = await manager.count(ThreadEntity, {
          where: { parentTaskId: taskId },
        });
        if (parentThreadCount === 0) {
          await manager.softRemove(TaskEntity, updatedTask);
          autoPruned = true;
        }
      }

      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_STATUS_CHANGED,
        actorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: { taskId, actorId },
      });
      if (autoPruned) {
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.TASK_DELETED,
          actorId,
          aggregateType: 'task',
          aggregateId: taskId,
          payload: { taskId, actorId },
        });
      }

      return { task: updatedTask, autoPruned };
    });
    return result;
  }
}
