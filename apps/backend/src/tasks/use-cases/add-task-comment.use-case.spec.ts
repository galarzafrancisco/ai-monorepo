jest.mock('@taico/errors', () => ({
  ErrorCodes: { TASK_NOT_FOUND: 'TASK_NOT_FOUND' },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { CommentEntity } from '../comment.entity';
import { TaskEntity } from '../task.entity';
import { AddTaskCommentUseCase } from './add-task-comment.use-case';

describe('AddTaskCommentUseCase', () => {
  it('creates the comment and durable event through the same transaction manager', async () => {
    const task = Object.assign(new TaskEntity(), { id: 'task-1' });
    const comment = Object.assign(new CommentEntity(), {
      id: 'comment-1',
      task,
      commenterActorId: 'actor-1',
      content: 'Progress update',
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const commentRepository = Object.create(
      Repository.prototype,
    ) as Repository<CommentEntity>;
    jest
      .spyOn(commentRepository, 'create')
      .mockImplementation((input) => Object.assign(new CommentEntity(), input));
    jest.spyOn(commentRepository, 'save').mockResolvedValue(comment);
    jest.spyOn(commentRepository, 'findOne').mockResolvedValue(comment);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof TaskEntity | typeof CommentEntity) =>
        entity === TaskEntity ? taskRepository : commentRepository,
    });
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
    const useCase = new AddTaskCommentUseCase(dataSource, outboxWriter);

    const result = await useCase.execute(task.id, {
      commenterActorId: 'actor-1',
      content: 'Progress update',
    });

    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_COMMENT_ADDED,
        payload: {
          taskId: task.id,
          commentId: comment.id,
          actorId: 'actor-1',
        },
      }),
    );
    expect(result).toBe(comment);
  });
});
