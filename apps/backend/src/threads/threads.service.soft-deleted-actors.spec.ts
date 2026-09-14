jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  },
}));

jest.mock('./chat.service', () => ({
  ChatService: jest.fn(),
}));

import { ThreadsService } from './threads.service';
import { ActorType } from '../identity-provider/enums';

describe('ThreadsService soft-deleted actors', () => {
  it('preserves a deleted agent persona on historical messages', async () => {
    const deletedAt = new Date('2026-09-14T08:00:00.000Z');
    const threadRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'thread-1' }),
    };
    const threadMessageRepository = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'message-1',
            threadId: 'thread-1',
            content: 'Completed before deletion',
            createdByActorId: 'deleted-agent-actor',
            createdByActor: {
              id: 'deleted-agent-actor',
              type: ActorType.AGENT,
              slug: 'retired-agent',
              displayName: 'Retired Agent',
              avatarUrl: '/avatar/retired.svg',
              introduction: null,
              deletedAt,
            },
            createdAt: deletedAt,
          },
        ],
        1,
      ]),
    };
    const service = new ThreadsService(
      threadRepository as any,
      threadMessageRepository as any,
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

    const result = await service.listMessages({
      threadId: 'thread-1',
      page: 1,
      limit: 20,
    });

    expect(threadMessageRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: 'thread-1' },
        relations: ['createdByActor'],
        withDeleted: true,
      }),
    );
    expect(result.items[0].createdByActor).toMatchObject({
      id: 'deleted-agent-actor',
      isDeactivated: true,
    });
  });

  it('does not expose deleted tasks or context blocks from a live thread', async () => {
    const service = new ThreadsService(
      {
        find: jest.fn().mockResolvedValue([
          {
            id: 'thread-1',
            title: 'History',
            chatSessionId: null,
            createdByActor: {
              id: 'human-1',
              type: ActorType.HUMAN,
              slug: 'fran',
              displayName: 'Fran',
              avatarUrl: null,
              introduction: null,
              deletedAt: null,
            },
            parentTaskId: null,
            stateContextBlockId: 'state-1',
            tasks: [
              {
                id: 'active-task',
                name: 'Active',
                description: '',
                status: 'NOT_STARTED',
                tags: [],
                comments: [],
                inputRequests: [],
                createdByActor: null,
                assigneeActor: null,
                updatedAt: new Date(),
                deletedAt: null,
              },
              {
                id: 'deleted-task',
                name: 'Deleted',
                description: '',
                status: 'NOT_STARTED',
                tags: [],
                comments: [],
                inputRequests: [],
                createdByActor: null,
                assigneeActor: null,
                updatedAt: new Date(),
                deletedAt: new Date(),
              },
            ],
            referencedContextBlocks: [
              { id: 'active-block', title: 'Active', deletedAt: null },
              { id: 'deleted-block', title: 'Deleted', deletedAt: new Date() },
            ],
            tags: [],
            participants: [],
            rowVersion: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ]),
      } as any,
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

    const [result] = await service.findThreadsByParentTaskId('parent-task-1');

    expect(result.tasks.map((task) => task.id)).toEqual(['active-task']);
    expect(result.referencedContextBlocks.map((block) => block.id)).toEqual([
      'active-block',
    ]);
  });
});
