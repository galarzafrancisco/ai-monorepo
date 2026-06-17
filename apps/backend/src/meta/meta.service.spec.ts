import { MetaService } from './meta.service';
import { AUTO_PRUNE_TAG_NAME } from './system-tags';

describe('MetaService system tags', () => {
  function createService() {
    const tagRepository = {
      create: jest.fn((tag) => tag),
      save: jest.fn(async (tag) => ({
        id: 'tag-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        ...tag,
      })),
      findOne: jest.fn(),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    const tagUsageRepository = {
      find: jest.fn(),
      query: jest.fn(),
    };
    const projectRepository = {
      findOne: jest.fn(),
      create: jest.fn((project) => project),
      save: jest.fn(async (project) => project),
    };

    const service = new MetaService(
      tagRepository as any,
      tagUsageRepository as any,
      projectRepository as any,
    );

    return {
      service,
      tagRepository,
    };
  }

  it('creates the auto-prune system tag on module init', async () => {
    const { service, tagRepository } = createService();
    tagRepository.findOne.mockResolvedValue(null);

    await service.onModuleInit();

    expect(tagRepository.create).toHaveBeenCalledWith({
      name: AUTO_PRUNE_TAG_NAME,
      color: '#8E7CC3',
    });
    expect(tagRepository.save).toHaveBeenCalled();
  });

  it('does not delete the auto-prune system tag directly', async () => {
    const { service, tagRepository } = createService();
    tagRepository.findOne.mockResolvedValue({
      id: 'tag-1',
      name: AUTO_PRUNE_TAG_NAME,
    });

    await service.deleteTag('tag-1');

    expect(tagRepository.delete).not.toHaveBeenCalled();
  });

  it('does not delete the auto-prune system tag as an orphan', async () => {
    const { service, tagRepository } = createService();
    tagRepository.findOne.mockResolvedValue({
      id: 'tag-1',
      name: AUTO_PRUNE_TAG_NAME,
      tasks: [],
      blocks: [],
    });

    await service.cleanupOrphanedTag('tag-1');

    expect(tagRepository.delete).not.toHaveBeenCalled();
  });
});
