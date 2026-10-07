jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
    PARENT_PAGE_NOT_FOUND: 'PARENT_PAGE_NOT_FOUND',
    CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
    BLOCK_IS_THREAD_STATE: 'BLOCK_IS_THREAD_STATE',
    BLOCK_HAS_CHILDREN: 'BLOCK_HAS_CHILDREN',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
  },
}));

jest.mock('../threads/threads.service', () => ({
  ThreadsService: jest.fn(),
}));

import { ContextService } from './context.service';
import { ActorType } from '../identity-provider/enums';

describe('ContextService soft-deleted actors', () => {
  it('preserves and identifies a deleted context author', async () => {
    const deletedAt = new Date('2026-09-14T08:00:00.000Z');
    const blockRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'block-1',
        title: 'Historical context',
        content: 'Created by a retired agent',
        createdByActorId: 'deleted-agent-actor',
        createdByActor: {
          id: 'deleted-agent-actor',
          type: ActorType.AGENT,
          slug: 'retired-agent',
          deletedAt,
        },
        createdBy: 'retired-agent',
        assigneeActorId: null,
        assigneeActor: null,
        tags: [],
        parentId: null,
        order: 0,
        createdAt: deletedAt,
        updatedAt: deletedAt,
        deletedAt: null,
      }),
    };
    const service = new ContextService(
      blockRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getBlockById('block-1');

    expect(blockRepository.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'block-1' }),
      withDeleted: true,
      relations: expect.arrayContaining(['createdByActor', 'assigneeActor']),
    });
    expect(result).toMatchObject({
      createdBy: 'retired-agent',
      createdByIsDeactivated: true,
    });
  });

  it('preserves deleted creator and assignee personas after adding a tag', async () => {
    const deletedAt = new Date('2026-09-14T08:00:00.000Z');
    const block = {
      id: 'block-1',
      title: 'Historical context',
      content: 'Created and assigned by retired agents',
      createdByActorId: 'deleted-creator',
      createdByActor: {
        id: 'deleted-creator',
        type: ActorType.AGENT,
        slug: 'retired-creator',
        deletedAt,
      },
      createdBy: 'retired-creator',
      assigneeActorId: 'deleted-assignee',
      assigneeActor: {
        id: 'deleted-assignee',
        type: ActorType.AGENT,
        slug: 'retired-assignee',
        deletedAt,
      },
      assignee: 'retired-assignee',
      tags: [],
      parentId: null,
      order: 0,
      createdAt: deletedAt,
      updatedAt: deletedAt,
      deletedAt: null,
    };
    const blockRepository = {
      findOne: jest.fn().mockResolvedValue(block),
      save: jest.fn().mockResolvedValue(block),
    };
    const service = new ContextService(
      blockRepository as any,
      { emit: jest.fn() } as any,
      {
        findOrCreateTagEntity: jest
          .fn()
          .mockResolvedValue({ id: 'tag-1', name: 'history' }),
        incrementTagUsage: jest.fn(),
      } as any,
      {} as any,
      {} as any,
    );

    const result = await service.addTagToBlock(
      'block-1',
      { name: 'history' },
      'active-actor',
    );

    expect(blockRepository.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'block-1' }),
      withDeleted: true,
      relations: expect.arrayContaining(['createdByActor', 'assigneeActor']),
    });
    expect(result).toMatchObject({
      createdBy: 'retired-creator',
      createdByIsDeactivated: true,
      assignee: 'retired-assignee',
      assigneeIsDeactivated: true,
    });
  });
});
