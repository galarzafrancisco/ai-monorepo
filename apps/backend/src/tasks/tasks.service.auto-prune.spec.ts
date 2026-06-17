jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
    TASK_NOT_ASSIGNED: 'TASK_NOT_ASSIGNED',
    INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
    COMMENT_REQUIRED: 'COMMENT_REQUIRED',
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    TASK_IS_THREAD_PARENT: 'TASK_IS_THREAD_PARENT',
    INPUT_REQUEST_SELF_ASSIGNMENT: 'INPUT_REQUEST_SELF_ASSIGNMENT',
  },
}));

jest.mock('../threads/threads.service', () => ({
  ThreadsService: jest.fn(),
}));

import { TasksService } from './tasks.service';
import { TaskStatus } from './enums';
import {
  TaskDeletedEvent,
  TaskStatusChangedEvent,
} from './events/tasks.events';

describe('TasksService auto-prune', () => {
  const actor = {
    id: 'actor-1',
    type: 'agent',
    slug: 'agent-1',
    displayName: 'Agent 1',
    avatarUrl: null,
    introduction: null,
  } as any;

  function createTask(overrides: Record<string, unknown> = {}) {
    return {
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
      tags: [{ id: 'tag-1', name: 'auto-prune' }],
      dependsOn: [],
      rowVersion: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      ...overrides,
    } as any;
  }

  function createService(options: { threadsWithParent?: unknown[] } = {}) {
    const taskRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (task) => task),
      softRemove: jest.fn(async (task) => ({ ...task, deletedAt: new Date() })),
    };
    const commentRepository = {
      create: jest.fn((comment) => comment),
      save: jest.fn(async (comment) => comment),
    };
    const eventEmitter = {
      emit: jest.fn(),
    };
    const threadsService = {
      findThreadsByParentTaskId: jest
        .fn()
        .mockResolvedValue(options.threadsWithParent ?? []),
    };

    const service = new TasksService(
      taskRepository as any,
      commentRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventEmitter as any,
      {} as any,
      {} as any,
      threadsService as any,
      {} as any,
    );

    return {
      service,
      taskRepository,
      commentRepository,
      eventEmitter,
      threadsService,
    };
  }

  it('soft-deletes an auto-prune tagged task after completion', async () => {
    const { service, taskRepository, eventEmitter, threadsService } =
      createService();
    const task = createTask();
    const completedTask = createTask({
      status: TaskStatus.DONE,
      comments: [{ id: 'comment-1' }],
    });

    taskRepository.findOne
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(completedTask)
      .mockResolvedValueOnce(completedTask);

    const result = await service.changeStatus(
      task.id,
      { status: TaskStatus.DONE, comment: 'Finished' },
      actor.id,
    );

    expect(result.status).toBe(TaskStatus.DONE);
    expect(threadsService.findThreadsByParentTaskId).toHaveBeenCalledWith(
      task.id,
    );
    expect(taskRepository.softRemove).toHaveBeenCalledWith(completedTask);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      TaskStatusChangedEvent.INTERNAL,
      expect.any(TaskStatusChangedEvent),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      TaskDeletedEvent.INTERNAL,
      expect.any(TaskDeletedEvent),
    );
  });

  it('keeps an auto-prune tagged task when it is a thread parent', async () => {
    const { service, taskRepository, eventEmitter, threadsService } = createService({
      threadsWithParent: [{ id: 'thread-1' }],
    });
    const task = createTask();
    const completedTask = createTask({
      status: TaskStatus.DONE,
      comments: [{ id: 'comment-1' }],
    });

    taskRepository.findOne
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(completedTask);

    const result = await service.changeStatus(
      task.id,
      { status: TaskStatus.DONE, comment: 'Finished' },
      actor.id,
    );

    expect(result.status).toBe(TaskStatus.DONE);
    expect(threadsService.findThreadsByParentTaskId).toHaveBeenCalledWith(
      task.id,
    );
    expect(taskRepository.softRemove).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      TaskStatusChangedEvent.INTERNAL,
      expect.any(TaskStatusChangedEvent),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      TaskDeletedEvent.INTERNAL,
      expect.any(TaskDeletedEvent),
    );
  });
});
