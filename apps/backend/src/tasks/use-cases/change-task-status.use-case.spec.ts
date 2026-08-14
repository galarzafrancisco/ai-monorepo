jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
    TASK_NOT_ASSIGNED: 'TASK_NOT_ASSIGNED',
    INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
    COMMENT_REQUIRED: 'COMMENT_REQUIRED',
  },
}));

import { DataSource, EntityManager } from 'typeorm';
import { ThreadEntity } from '../../threads/thread.entity';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ActorType } from '../../identity-provider/enums';
import { TagEntity } from '../../meta/tag.entity';
import { CommentEntity } from '../comment.entity';
import { TaskStatus } from '../enums';
import { CommentRequiredError } from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ChangeTaskStatusUseCase } from './change-task-status.use-case';

describe('ChangeTaskStatusUseCase', () => {
  const actor = Object.assign(new ActorEntity(), {
    id: 'actor-1',
    type: ActorType.AGENT,
    slug: 'agent-1',
    displayName: 'Agent 1',
    avatarUrl: null,
    introduction: null,
  });

  function createTag(name = 'auto-prune'): TagEntity {
    return Object.assign(new TagEntity(), {
      id: 'tag-1',
      name,
      color: null,
      tasks: [],
      blocks: [],
      threads: [],
      rowVersion: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    });
  }

  function createTask(overrides: Partial<TaskEntity> = {}) {
    return Object.assign(new TaskEntity(), {
      id: 'task-1',
      name: 'Task 1',
      description: 'Description',
      status: TaskStatus.IN_PROGRESS,
      assigneeActorId: actor.id,
      assigneeActor: actor,
      createdByActorId: actor.id,
      createdByActor: actor,
      sessionId: null,
      comments: [],
      artefacts: [],
      inputRequests: [],
      tags: [],
      dependsOn: [],
      dependents: [],
      rowVersion: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      ...overrides,
    });
  }

  function createUseCase(
    options: {
      task?: TaskEntity | null;
      updatedTask?: TaskEntity | null;
      parentThreadCount?: number;
    } = {},
  ) {
    const task = options.task ?? createTask();
    const updatedTask =
      options.updatedTask ??
      createTask({
        status: TaskStatus.DONE,
      });
    const taskRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(updatedTask),
      save: jest.fn(async (entity) => entity),
    };
    const commentRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
    };
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: jest.fn((entity) =>
        entity === TaskEntity ? taskRepository : commentRepository,
      ),
    });
    Object.defineProperty(manager, 'count', {
      value: jest.fn().mockResolvedValue(options.parentThreadCount ?? 0),
    });
    Object.defineProperty(manager, 'softRemove', {
      value: jest.fn(async (_entity, value) => value),
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const outboxWriter: Pick<OutboxWriterService, 'enqueue'> = {
      enqueue: jest.fn(),
    };

    return {
      useCase: new ChangeTaskStatusUseCase(dataSource, outboxWriter),
      dataSource,
      manager,
      taskRepository,
      commentRepository,
      outboxWriter,
    };
  }

  it('writes the DONE comment, task status, and outbox event in one transaction', async () => {
    const {
      useCase,
      dataSource,
      manager,
      taskRepository,
      commentRepository,
      outboxWriter,
    } = createUseCase();

    const result = await useCase.execute(
      'task-1',
      { status: TaskStatus.DONE, comment: 'Finished' },
      actor.id,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).toHaveBeenCalledWith(TaskEntity);
    expect(manager.getRepository).toHaveBeenCalledWith(CommentEntity);
    expect(commentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Finished',
        task: expect.any(Object),
      }),
    );
    expect(taskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: TaskStatus.DONE }),
    );
    expect(outboxWriter.enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_STATUS_CHANGED,
        payload: { taskId: 'task-1', actorId: actor.id },
      }),
    );
    expect(result.autoPruned).toBe(false);
  });

  it('does not write or enqueue when DONE has neither an inline nor existing comment', async () => {
    const { useCase, taskRepository, commentRepository, outboxWriter } =
      createUseCase({ task: createTask(), updatedTask: createTask() });

    await expect(
      useCase.execute('task-1', { status: TaskStatus.DONE }, actor.id),
    ).rejects.toBeInstanceOf(CommentRequiredError);

    expect(commentRepository.save).not.toHaveBeenCalled();
    expect(taskRepository.save).not.toHaveBeenCalled();
    expect(outboxWriter.enqueue).not.toHaveBeenCalled();
  });

  it('auto-prunes and enqueues both events within the transaction', async () => {
    const autoPruneTask = createTask({
      status: TaskStatus.DONE,
      tags: [createTag()],
    });
    const { useCase, manager, outboxWriter } = createUseCase({
      updatedTask: autoPruneTask,
    });

    const result = await useCase.execute(
      'task-1',
      { status: TaskStatus.DONE, comment: 'Finished' },
      actor.id,
    );

    expect(manager.count).toHaveBeenCalledWith(ThreadEntity, {
      where: { parentTaskId: 'task-1' },
    });
    expect(manager.softRemove).toHaveBeenCalledWith(TaskEntity, autoPruneTask);
    expect(outboxWriter.enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ type: OutboxEventTypes.TASK_DELETED }),
    );
    expect(result.autoPruned).toBe(true);
  });
});
