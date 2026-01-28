import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContextService } from './context.service';
import { ContextBlockEntity } from './block.entity';
import { ContextTagEntity } from './tag.entity';
import {
  BlockNotFoundError,
  ParentBlockNotFoundError,
  CircularReferenceError,
} from './errors/context.errors';

describe('ContextService', () => {
  let service: ContextService;
  let pageRepository: Repository<ContextBlockEntity>;
  let tagRepository: Repository<ContextTagEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        {
          provide: getRepositoryToken(ContextBlockEntity),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(ContextTagEntity),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ContextService>(ContextService);
    pageRepository = module.get<Repository<ContextBlockEntity>>(
      getRepositoryToken(ContextBlockEntity),
    );
    tagRepository = module.get<Repository<ContextTagEntity>>(
      getRepositoryToken(ContextTagEntity),
    );
  });

  describe('createBlock', () => {
    it('should create a page with default order 0 when no siblings exist', async () => {
      const mockPage = {
        id: '1',
        title: 'Test Page',
        content: 'Test Content',
        createdByActorId: 'Test Author',
        parentId: null,
        order: 0,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(pageRepository, 'find').mockResolvedValue([]);
      jest.spyOn(pageRepository, 'create').mockReturnValue(mockPage as any);
      jest.spyOn(pageRepository, 'save').mockResolvedValue(mockPage as any);
      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage as any);

      const result = await service.createBlock({
        title: 'Test Page',
        content: 'Test Content',
        createdByActorId: 'Test Author',
        parentId: null,
      });

      expect(result.order).toBe(0);
      expect(pageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 0,
        }),
      );
    });

    it('should create a page with order = max sibling order + 1', async () => {
      const existingSibling = {
        id: '1',
        order: 5,
      } as ContextBlockEntity;

      jest.spyOn(pageRepository, 'find').mockResolvedValue([existingSibling]);
      jest.spyOn(pageRepository, 'create').mockReturnValue({
        id: '2',
        order: 6,
      } as any);
      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        id: '2',
        order: 6,
        tags: [],
      } as any);
      jest.spyOn(pageRepository, 'findOne').mockResolvedValue({
        id: '2',
        order: 6,
        tags: [],
      } as any);

      const result = await service.createBlock({
        title: 'Test Page',
        content: 'Test Content',
        createdByActorId: 'Test Author',
        parentId: null,
      });

      expect(result.order).toBe(6);
    });

    it('should throw ParentBlockNotFoundError when parent does not exist', async () => {
      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.createBlock({
          title: 'Test Page',
          content: 'Test Content',
          createdByActorId: 'Test Author',
          parentId: 'non-existent-id',
        }),
      ).rejects.toThrow(ParentBlockNotFoundError);
    });
  });

  describe('updateBlock - circular reference detection', () => {
    it('should throw CircularReferenceError when setting page as its own parent', async () => {
      const mockPage = {
        id: 'block-1',
        title: 'Test Page',
        content: 'Test Content',
        createdByActorId: 'Test Author',
        parentId: null,
        order: 0,
        tags: [],
      } as unknown as ContextBlockEntity;

      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage);

      await expect(
        service.updateBlock('block-1', {
          parentId: 'block-1',
        }),
      ).rejects.toThrow(CircularReferenceError);
    });

    it('should throw CircularReferenceError for circular chain (A → B → C → A)', async () => {
      // Page A trying to set parent to C
      const pageA = {
        id: 'block-a',
        parentId: null,
        tags: [],
      } as unknown as ContextBlockEntity;

      const pageB = {
        id: 'block-b',
        parentId: 'block-a',
      } as unknown as ContextBlockEntity;

      const pageC = {
        id: 'block-c',
        parentId: 'block-b',
      } as unknown as ContextBlockEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'block-a') return Promise.resolve(pageA);
          if (where.id === 'block-b') return Promise.resolve(pageB);
          if (where.id === 'block-c') return Promise.resolve(pageC);
          return Promise.resolve(null);
        });

      // Trying to set A's parent to C would create: C → B → A → C
      await expect(
        service.updateBlock('block-a', {
          parentId: 'block-c',
        }),
      ).rejects.toThrow(CircularReferenceError);
    });

    it('should allow valid parent change', async () => {
      const pageA = {
        id: 'block-a',
        parentId: null,
        tags: [],
        order: 0,
      } as unknown as ContextBlockEntity;

      const pageB = {
        id: 'block-b',
        parentId: null,
      } as unknown as ContextBlockEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'block-a') return Promise.resolve(pageA);
          if (where.id === 'block-b') return Promise.resolve(pageB);
          return Promise.resolve(null);
        });

      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        ...pageA,
        parentId: 'block-b',
      } as any);

      const result = await service.updateBlock('block-a', {
        parentId: 'block-b',
      });

      expect(result.parentId).toBe('block-b');
    });
  });

  describe('moveBlock', () => {
    it('should throw CircularReferenceError when moving page to itself', async () => {
      const mockPage = {
        id: 'block-1',
        tags: [],
      } as unknown as ContextBlockEntity;

      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage);

      await expect(service.moveBlock('block-1', 'block-1')).rejects.toThrow(
        CircularReferenceError,
      );
    });

    it('should throw ParentBlockNotFoundError when moving to non-existent parent', async () => {
      const mockPage = {
        id: 'block-1',
        tags: [],
      } as unknown as ContextBlockEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'block-1') return Promise.resolve(mockPage);
          return Promise.resolve(null);
        });

      await expect(
        service.moveBlock('block-1', 'non-existent-parent'),
      ).rejects.toThrow(ParentBlockNotFoundError);
    });

    it('should update order when moving to new parent', async () => {
      const page = {
        id: 'block-1',
        parentId: null,
        order: 0,
        tags: [],
      } as unknown as ContextBlockEntity;

      const newParent = {
        id: 'parent-1',
        parentId: null,
      } as unknown as ContextBlockEntity;

      const existingChild = {
        id: 'child-1',
        parentId: 'parent-1',
        order: 2,
      } as unknown as ContextBlockEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'block-1') return Promise.resolve(page);
          if (where.id === 'parent-1') return Promise.resolve(newParent);
          return Promise.resolve(null);
        });

      jest.spyOn(pageRepository, 'find').mockResolvedValue([existingChild]);

      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        ...page,
        parentId: 'parent-1',
        order: 3,
      } as any);

      const result = await service.moveBlock('block-1', 'parent-1');

      expect(result.parentId).toBe('parent-1');
      expect(result.order).toBe(3);
    });
  });

  describe('getBlockTree', () => {
    it('should return proper hierarchy with children sorted by order', async () => {
      const pages = [
        {
          id: 'root-1',
          title: 'Root 1',
          createdByActorId: 'Author',
          parentId: null,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'child-2',
          title: 'Child 2',
          createdByActorId: 'Author',
          parentId: 'root-1',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'child-1',
          title: 'Child 1',
          createdByActorId: 'Author',
          parentId: 'root-1',
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'root-2',
          title: 'Root 2',
          createdByActorId: 'Author',
          parentId: null,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as ContextBlockEntity[];

      jest.spyOn(pageRepository, 'find').mockResolvedValue(pages);

      const result = await service.getBlockTree();

      // Should have 2 root pages
      expect(result).toHaveLength(2);

      // Find root-1
      const root1 = result.find((p) => p.id === 'root-1');
      expect(root1).toBeDefined();
      expect(root1!.children).toHaveLength(2);

      // Children should be sorted by order
      expect(root1!.children[0].id).toBe('child-1');
      expect(root1!.children[1].id).toBe('child-2');
    });

    it('should handle orphaned pages (parent not found)', async () => {
      const pages = [
        {
          id: 'block-1',
          title: 'Page 1',
          createdByActorId: 'Author',
          parentId: 'non-existent',
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as ContextBlockEntity[];

      jest.spyOn(pageRepository, 'find').mockResolvedValue(pages);

      const result = await service.getBlockTree();

      // Orphaned page should be treated as root
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('block-1');
    });
  });

  describe('reorderBlock', () => {
    it('should update page order', async () => {
      const mockPage = {
        id: 'block-1',
        order: 0,
        tags: [],
      } as unknown as ContextBlockEntity;

      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage);
      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        ...mockPage,
        order: 5,
      } as any);

      const result = await service.reorderBlock('block-1', 5);

      expect(result.order).toBe(5);
      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ order: 5 }),
      );
    });

    it('should throw BlockNotFoundError when page does not exist', async () => {
      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(null);

      await expect(service.reorderBlock('non-existent', 5)).rejects.toThrow(
        BlockNotFoundError,
      );
    });
  });
});
