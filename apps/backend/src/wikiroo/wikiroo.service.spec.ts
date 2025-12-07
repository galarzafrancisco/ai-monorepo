import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WikirooService } from './wikiroo.service';
import { WikiPageEntity } from './page.entity';
import { WikiTagEntity } from './tag.entity';
import {
  PageNotFoundError,
  ParentPageNotFoundError,
  CircularReferenceError,
} from './errors/wikiroo.errors';

describe('WikirooService', () => {
  let service: WikirooService;
  let pageRepository: Repository<WikiPageEntity>;
  let tagRepository: Repository<WikiTagEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WikirooService,
        {
          provide: getRepositoryToken(WikiPageEntity),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(WikiTagEntity),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<WikirooService>(WikirooService);
    pageRepository = module.get<Repository<WikiPageEntity>>(
      getRepositoryToken(WikiPageEntity),
    );
    tagRepository = module.get<Repository<WikiTagEntity>>(
      getRepositoryToken(WikiTagEntity),
    );
  });

  describe('createPage', () => {
    it('should create a page with default order 0 when no siblings exist', async () => {
      const mockPage = {
        id: '1',
        title: 'Test Page',
        content: 'Test Content',
        author: 'Test Author',
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

      const result = await service.createPage({
        title: 'Test Page',
        content: 'Test Content',
        author: 'Test Author',
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
      } as WikiPageEntity;

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

      const result = await service.createPage({
        title: 'Test Page',
        content: 'Test Content',
        author: 'Test Author',
        parentId: null,
      });

      expect(result.order).toBe(6);
    });

    it('should throw ParentPageNotFoundError when parent does not exist', async () => {
      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.createPage({
          title: 'Test Page',
          content: 'Test Content',
          author: 'Test Author',
          parentId: 'non-existent-id',
        }),
      ).rejects.toThrow(ParentPageNotFoundError);
    });
  });

  describe('updatePage - circular reference detection', () => {
    it('should throw CircularReferenceError when setting page as its own parent', async () => {
      const mockPage = {
        id: 'page-1',
        title: 'Test Page',
        content: 'Test Content',
        author: 'Test Author',
        parentId: null,
        order: 0,
        tags: [],
      } as unknown as WikiPageEntity;

      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage);

      await expect(
        service.updatePage('page-1', {
          parentId: 'page-1',
        }),
      ).rejects.toThrow(CircularReferenceError);
    });

    it('should throw CircularReferenceError for circular chain (A → B → C → A)', async () => {
      // Page A trying to set parent to C
      const pageA = {
        id: 'page-a',
        parentId: null,
        tags: [],
      } as unknown as WikiPageEntity;

      const pageB = {
        id: 'page-b',
        parentId: 'page-a',
      } as unknown as WikiPageEntity;

      const pageC = {
        id: 'page-c',
        parentId: 'page-b',
      } as unknown as WikiPageEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'page-a') return Promise.resolve(pageA);
          if (where.id === 'page-b') return Promise.resolve(pageB);
          if (where.id === 'page-c') return Promise.resolve(pageC);
          return Promise.resolve(null);
        });

      // Trying to set A's parent to C would create: C → B → A → C
      await expect(
        service.updatePage('page-a', {
          parentId: 'page-c',
        }),
      ).rejects.toThrow(CircularReferenceError);
    });

    it('should allow valid parent change', async () => {
      const pageA = {
        id: 'page-a',
        parentId: null,
        tags: [],
        order: 0,
      } as unknown as WikiPageEntity;

      const pageB = {
        id: 'page-b',
        parentId: null,
      } as unknown as WikiPageEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'page-a') return Promise.resolve(pageA);
          if (where.id === 'page-b') return Promise.resolve(pageB);
          return Promise.resolve(null);
        });

      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        ...pageA,
        parentId: 'page-b',
      } as any);

      const result = await service.updatePage('page-a', {
        parentId: 'page-b',
      });

      expect(result.parentId).toBe('page-b');
    });
  });

  describe('movePage', () => {
    it('should throw CircularReferenceError when moving page to itself', async () => {
      const mockPage = {
        id: 'page-1',
        tags: [],
      } as unknown as WikiPageEntity;

      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage);

      await expect(service.movePage('page-1', 'page-1')).rejects.toThrow(
        CircularReferenceError,
      );
    });

    it('should throw ParentPageNotFoundError when moving to non-existent parent', async () => {
      const mockPage = {
        id: 'page-1',
        tags: [],
      } as unknown as WikiPageEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'page-1') return Promise.resolve(mockPage);
          return Promise.resolve(null);
        });

      await expect(
        service.movePage('page-1', 'non-existent-parent'),
      ).rejects.toThrow(ParentPageNotFoundError);
    });

    it('should update order when moving to new parent', async () => {
      const page = {
        id: 'page-1',
        parentId: null,
        order: 0,
        tags: [],
      } as unknown as WikiPageEntity;

      const newParent = {
        id: 'parent-1',
        parentId: null,
      } as unknown as WikiPageEntity;

      const existingChild = {
        id: 'child-1',
        parentId: 'parent-1',
        order: 2,
      } as unknown as WikiPageEntity;

      jest
        .spyOn(pageRepository, 'findOne')
        .mockImplementation(({ where }: any) => {
          if (where.id === 'page-1') return Promise.resolve(page);
          if (where.id === 'parent-1') return Promise.resolve(newParent);
          return Promise.resolve(null);
        });

      jest.spyOn(pageRepository, 'find').mockResolvedValue([existingChild]);

      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        ...page,
        parentId: 'parent-1',
        order: 3,
      } as any);

      const result = await service.movePage('page-1', 'parent-1');

      expect(result.parentId).toBe('parent-1');
      expect(result.order).toBe(3);
    });
  });

  describe('getPageTree', () => {
    it('should return proper hierarchy with children sorted by order', async () => {
      const pages = [
        {
          id: 'root-1',
          title: 'Root 1',
          author: 'Author',
          parentId: null,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'child-2',
          title: 'Child 2',
          author: 'Author',
          parentId: 'root-1',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'child-1',
          title: 'Child 1',
          author: 'Author',
          parentId: 'root-1',
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'root-2',
          title: 'Root 2',
          author: 'Author',
          parentId: null,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as WikiPageEntity[];

      jest.spyOn(pageRepository, 'find').mockResolvedValue(pages);

      const result = await service.getPageTree();

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
          id: 'page-1',
          title: 'Page 1',
          author: 'Author',
          parentId: 'non-existent',
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as WikiPageEntity[];

      jest.spyOn(pageRepository, 'find').mockResolvedValue(pages);

      const result = await service.getPageTree();

      // Orphaned page should be treated as root
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('page-1');
    });
  });

  describe('reorderPage', () => {
    it('should update page order', async () => {
      const mockPage = {
        id: 'page-1',
        order: 0,
        tags: [],
      } as unknown as WikiPageEntity;

      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(mockPage);
      jest.spyOn(pageRepository, 'save').mockResolvedValue({
        ...mockPage,
        order: 5,
      } as any);

      const result = await service.reorderPage('page-1', 5);

      expect(result.order).toBe(5);
      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ order: 5 }),
      );
    });

    it('should throw PageNotFoundError when page does not exist', async () => {
      jest.spyOn(pageRepository, 'findOne').mockResolvedValue(null);

      await expect(service.reorderPage('non-existent', 5)).rejects.toThrow(
        PageNotFoundError,
      );
    });
  });
});
