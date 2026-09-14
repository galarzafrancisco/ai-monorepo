import { TasksService } from './tasks.service';
import { ActorType } from '../identity-provider/enums';
import { TaskStatus } from './enums';

describe('TasksService soft-deleted actors', () => {
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
