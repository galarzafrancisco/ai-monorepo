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
import { ActorType } from '../identity-provider/enums';
import { TaskStatus } from './enums';

describe('TasksService soft-deleted actors', () => {
  it('keeps soft-deleted tasks out of tag-filtered lists', () => {
    const queryBuilder = {
      withDeleted: jest.fn(),
      leftJoinAndSelect: jest.fn(),
      andWhere: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
    };
    Object.values(queryBuilder).forEach((method) =>
      method.mockReturnValue(queryBuilder),
    );
    const taskRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new TasksService(
      taskRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (service as any).createListTasksQuery(taskRepository, {
      page: 1,
      limit: 20,
      tag: 'important',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.deletedAt IS NULL');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'filterTag.name = :tagName',
      { tagName: 'important' },
    );
    expect(queryBuilder.where).not.toHaveBeenCalled();
  });

  it('preserves deactivated creator, assignee, and commenter personas', async () => {
    const deletedAt = new Date('2026-09-14T08:00:00.000Z');
    const deletedActor = {
      id: 'deleted-agent-actor',
      type: ActorType.AGENT,
      slug: 'retired-agent',
      displayName: 'Retired Agent',
      avatarUrl: '/avatar/retired.svg',
      introduction: null,
      deletedAt,
    };
    const taskRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'task-1',
        name: 'Historical task',
        description: 'Keeps its agent persona',
        status: TaskStatus.DONE,
        assignee: 'retired-agent',
        assigneeActor: deletedActor,
        sessionId: null,
        comments: [
          {
            id: 'comment-1',
            taskId: 'task-1',
            commenterName: 'Retired Agent',
            commenterActor: deletedActor,
            content: 'Completed before deletion',
            createdAt: deletedAt,
          },
        ],
        artefacts: [],
        inputRequests: [],
        tags: [],
        createdByActor: deletedActor,
        dependsOn: [],
        rowVersion: 1,
        createdAt: deletedAt,
        updatedAt: deletedAt,
        deletedAt: null,
      }),
    };
    const service = new TasksService(
      taskRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getTaskById('task-1');

    expect(taskRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        withDeleted: true,
        relations: expect.arrayContaining([
          'createdByActor',
          'assigneeActor',
          'comments.commenterActor',
        ]),
      }),
    );
    expect(result.createdByActor).toMatchObject({
      id: deletedActor.id,
      isDeactivated: true,
    });
    expect(result.assigneeActor).toMatchObject({
      id: deletedActor.id,
      isDeactivated: true,
    });
    expect(result.comments[0].commenterActor).toMatchObject({
      id: deletedActor.id,
      isDeactivated: true,
    });
  });
});
