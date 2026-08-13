import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { CommentEntity } from '../comment.entity';
import { CreateCommentInput } from '../dto/service/tasks.service.types';
import { TaskNotFoundError } from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';

/** Owns comment creation and its durable notification. */
@Injectable()
export class AddTaskCommentUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    taskId: string,
    input: CreateCommentInput,
  ): Promise<CommentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const commentRepository = manager.getRepository(CommentEntity);
      const task = await taskRepository.findOne({ where: { id: taskId } });
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }
      const comment = await commentRepository.save(
        commentRepository.create({
          task,
          commenterActorId: input.commenterActorId,
          content: input.content,
        }),
      );
      const commentWithRelations = await commentRepository.findOne({
        where: { id: comment.id },
        relations: ['commenterActor', 'task'],
      });
      if (!commentWithRelations) {
        throw new Error(`Comment ${comment.id} was not found after creation`);
      }
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_COMMENT_ADDED,
        actorId: input.commenterActorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: {
          taskId,
          commentId: comment.id,
          actorId: input.commenterActorId,
        },
      });
      return commentWithRelations;
    });
  }
}
