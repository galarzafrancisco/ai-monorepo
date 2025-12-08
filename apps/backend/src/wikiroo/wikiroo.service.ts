import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WikiPageEntity } from './page.entity';
import { WikiTagEntity } from './tag.entity';
import {
  AddTagInput,
  AppendPageInput,
  CreatePageInput,
  CreateTagInput,
  ListPagesInput,
  PageResult,
  PageSummaryResult,
  PageTreeResult,
  TagResult,
  UpdatePageInput,
} from './dto/service/wikiroo.service.types';
import {
  PageNotFoundError,
  ParentPageNotFoundError,
  CircularReferenceError,
} from './errors/wikiroo.errors';
import { getRandomTagColor } from '../common/utils/color-palette.util';

@Injectable()
export class WikirooService {
  private readonly logger = new Logger(WikirooService.name);

  constructor(
    @InjectRepository(WikiPageEntity)
    private readonly pageRepository: Repository<WikiPageEntity>,
    @InjectRepository(WikiTagEntity)
    private readonly tagRepository: Repository<WikiTagEntity>,
  ) {}

  async createPage(input: CreatePageInput): Promise<PageResult> {
    this.logger.log({
      message: 'Creating wiki page',
      title: input.title,
      author: input.author,
    });

    // Validate parent exists if provided
    if (input.parentId) {
      const parent = await this.pageRepository.findOne({
        where: { id: input.parentId },
      });
      if (!parent) {
        throw new ParentPageNotFoundError(input.parentId);
      }
    }

    // Calculate default order (max sibling order + 1)
    let order = 0;
    if (input.parentId !== undefined) {
      const whereClause = input.parentId === null
        ? { parentId: null as any }
        : { parentId: input.parentId };

      const siblings = await this.pageRepository.find({
        where: whereClause,
        order: { order: 'DESC' },
        take: 1,
      });
      if (siblings.length > 0) {
        order = siblings[0].order + 1;
      }
    }

    const page = this.pageRepository.create({
      title: input.title,
      content: input.content,
      author: input.author,
      parentId: input.parentId,
      order,
      tags: [],
    });

    const saved = await this.pageRepository.save(page);

    // Handle tags if provided
    if (input.tagNames && input.tagNames.length > 0) {
      const tags = await this.findOrCreateTags(input.tagNames);
      saved.tags = tags;
      await this.pageRepository.save(saved);
    }

    // Reload with relations
    const pageWithTags = await this.pageRepository.findOne({
      where: { id: saved.id },
      relations: ['tags'],
    });

    this.logger.log({
      message: 'Wiki page created',
      pageId: saved.id,
    });

    return this.mapToResult(pageWithTags!);
  }

  async listPages(input?: ListPagesInput): Promise<PageSummaryResult[]> {
    this.logger.log({ message: 'Listing wiki pages', tag: input?.tag });

    // If tag filter is provided, use query builder for join
    if (input?.tag) {
      const pages = await this.pageRepository
        .createQueryBuilder('page')
        .leftJoinAndSelect('page.tags', 'tags')
        .innerJoin('page.tags', 'filterTag')
        .where('filterTag.name = :tagName', { tagName: input.tag })
        .orderBy('page.createdAt', 'DESC')
        .getMany();

      return pages.map((page) => this.mapToSummary(page));
    }

    // Standard filtering without tags
    const pages = await this.pageRepository.find({
      relations: ['tags'],
      order: { createdAt: 'DESC' },
    });

    return pages.map((page) => this.mapToSummary(page));
  }

  async getPageById(pageId: string): Promise<PageResult> {
    this.logger.log({ message: 'Fetching wiki page', pageId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    return this.mapToResult(page);
  }

  async updatePage(
    pageId: string,
    input: UpdatePageInput,
  ): Promise<PageResult> {
    this.logger.log({ message: 'Updating wiki page', pageId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    // Validate parent changes
    if (input.parentId !== undefined) {
      // Prevent self-reference
      if (input.parentId === pageId) {
        throw new CircularReferenceError();
      }

      // Validate parent exists if not null
      if (input.parentId !== null) {
        const parent = await this.pageRepository.findOne({
          where: { id: input.parentId },
        });
        if (!parent) {
          throw new ParentPageNotFoundError(input.parentId);
        }

        // Check for circular reference
        await this.validateNoCircularReference(pageId, input.parentId);
      }

      page.parentId = input.parentId;
    }

    if (input.title !== undefined) {
      page.title = input.title;
    }
    if (input.content !== undefined) {
      page.content = input.content;
    }
    if (input.author !== undefined) {
      page.author = input.author;
    }
    if (input.order !== undefined) {
      page.order = input.order;
    }

    // Handle tags if provided
    if (input.tagNames !== undefined) {
      if (input.tagNames.length === 0) {
        page.tags = [];
      } else {
        page.tags = await this.findOrCreateTags(input.tagNames);
      }
    }

    const saved = await this.pageRepository.save(page);

    // Reload with relations
    const pageWithTags = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    this.logger.log({ message: 'Wiki page updated', pageId: saved.id });

    return this.mapToResult(pageWithTags!);
  }

  async appendToPage(
    pageId: string,
    input: AppendPageInput,
  ): Promise<PageResult> {
    this.logger.log({ message: 'Appending wiki page content', pageId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    page.content = `${page.content}${input.content}`;

    const saved = await this.pageRepository.save(page);

    this.logger.log({ message: 'Wiki page content appended', pageId: saved.id });

    return this.mapToResult(saved);
  }

  async deletePage(pageId: string): Promise<void> {
    this.logger.log({ message: 'Deleting wiki page', pageId });

    const result = await this.pageRepository.delete(pageId);

    if (!result.affected) {
      throw new PageNotFoundError(pageId);
    }

    this.logger.log({ message: 'Wiki page deleted', pageId });
  }

  async createTag(input: CreateTagInput): Promise<TagResult> {
    this.logger.log({
      message: 'Creating tag',
      tagName: input.name,
    });

    // Check if tag already exists (case-insensitive)
    let tag = await this.tagRepository.findOne({ where: { name: input.name } });

    if (!tag) {
      // Create new tag with random color
      tag = this.tagRepository.create({
        name: input.name,
        color: getRandomTagColor(),
      });
      tag = await this.tagRepository.save(tag);
      this.logger.log({
        message: 'Tag created',
        tagId: tag.id,
        tagName: tag.name,
        color: tag.color,
      });
    } else {
      this.logger.log({
        message: 'Tag already exists',
        tagId: tag.id,
        tagName: tag.name,
      });
    }

    return this.mapTagToResult(tag);
  }

  async addTagToPage(pageId: string, input: AddTagInput): Promise<PageResult> {
    this.logger.log({ message: 'Adding tag to page', pageId, tagName: input.name });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    // Find or create the tag (case-insensitive)
    let tag = await this.tagRepository.findOne({ where: { name: input.name } });

    if (!tag) {
      tag = this.tagRepository.create({
        name: input.name,
        color: input.color ?? getRandomTagColor(),
      });
      tag = await this.tagRepository.save(tag);
    }

    // Add tag to page if not already present
    if (!page.tags.some((t) => t.id === tag.id)) {
      page.tags.push(tag);
      await this.pageRepository.save(page);
    }

    // Reload with relations
    const pageWithRelations = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    this.logger.log({ message: 'Tag added to page', pageId, tagId: tag.id });

    return this.mapToResult(pageWithRelations!);
  }

  async removeTagFromPage(pageId: string, tagId: string): Promise<PageResult> {
    this.logger.log({ message: 'Removing tag from page', pageId, tagId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    page.tags = page.tags.filter((tag) => tag.id !== tagId);
    await this.pageRepository.save(page);

    this.logger.log({ message: 'Tag removed from page', pageId, tagId });

    // Check if tag is now orphaned and clean it up
    await this.cleanupOrphanedTag(tagId);

    return this.mapToResult(page);
  }

  async getAllTags(): Promise<TagResult[]> {
    this.logger.log({ message: 'Getting all tags' });

    const tags = await this.tagRepository.find({
      order: { name: 'ASC' },
    });

    return tags.map((tag) => this.mapTagToResult(tag));
  }

  async deleteTag(tagId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting tag',
      tagId,
    });

    const result = await this.tagRepository.softDelete(tagId);

    if (result.affected === 0) {
      this.logger.warn({
        message: 'Tag not found for deletion',
        tagId,
      });
    } else {
      this.logger.log({
        message: 'Tag deleted',
        tagId,
      });
    }
  }

  private async cleanupOrphanedTag(tagId: string): Promise<void> {
    this.logger.log({
      message: 'Checking if tag is orphaned',
      tagId,
    });

    const tagWithPages = await this.tagRepository.findOne({
      where: { id: tagId },
      relations: ['pages'],
    });

    if (!tagWithPages) {
      this.logger.warn({
        message: 'Tag not found for cleanup check',
        tagId,
      });
      return;
    }

    if (tagWithPages.pages.length === 0) {
      this.logger.log({
        message: 'Tag is orphaned, cleaning up',
        tagId,
        tagName: tagWithPages.name,
      });

      await this.tagRepository.softDelete(tagId);

      this.logger.log({
        message: 'Orphaned tag cleaned up',
        tagId,
      });
    } else {
      this.logger.log({
        message: 'Tag still has pages, keeping it',
        tagId,
        pageCount: tagWithPages.pages.length,
      });
    }
  }

  async getChildPages(parentId: string | null): Promise<PageSummaryResult[]> {
    this.logger.log({ message: 'Fetching child pages', parentId });

    const whereClause = parentId === null
      ? { parentId: null as any }
      : { parentId };

    const children = await this.pageRepository.find({
      where: whereClause,
      relations: ['tags'],
      order: { order: 'ASC' },
    });

    return children.map((page) => this.mapToSummary(page));
  }

  async getPageTree(): Promise<PageTreeResult[]> {
    this.logger.log({ message: 'Fetching page tree' });

    // Get all pages
    const allPages = await this.pageRepository.find({
      order: { order: 'ASC' },
    });

    // Build tree structure
    const pageMap = new Map<string, PageTreeResult>();
    const rootPages: PageTreeResult[] = [];

    // First pass: create all nodes
    for (const page of allPages) {
      pageMap.set(page.id, {
        id: page.id,
        title: page.title,
        author: page.author,
        parentId: page.parentId ?? null,
        order: page.order,
        children: [],
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      });
    }

    // Second pass: build tree
    for (const page of allPages) {
      const node = pageMap.get(page.id)!;
      if (page.parentId === null || page.parentId === undefined) {
        rootPages.push(node);
      } else {
        const parent = pageMap.get(page.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootPages.push(node);
        }
      }
    }

    return rootPages;
  }

  async reorderPage(pageId: string, newOrder: number): Promise<PageResult> {
    this.logger.log({ message: 'Reordering page', pageId, newOrder });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    page.order = newOrder;
    await this.pageRepository.save(page);

    return this.mapToResult(page);
  }

  async movePage(
    pageId: string,
    newParentId: string | null,
  ): Promise<PageResult> {
    this.logger.log({ message: 'Moving page', pageId, newParentId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    // Prevent self-reference
    if (newParentId === pageId) {
      throw new CircularReferenceError();
    }

    // Validate parent exists if not null
    if (newParentId !== null) {
      const parent = await this.pageRepository.findOne({
        where: { id: newParentId },
      });
      if (!parent) {
        throw new ParentPageNotFoundError(newParentId);
      }

      // Check for circular reference
      await this.validateNoCircularReference(pageId, newParentId);
    }

    page.parentId = newParentId;

    // Calculate new order (append to end of siblings)
    const whereClause = newParentId === null
      ? { parentId: null as any }
      : { parentId: newParentId };

    const siblings = await this.pageRepository.find({
      where: whereClause,
      order: { order: 'DESC' },
      take: 1,
    });
    page.order = siblings.length > 0 ? siblings[0].order + 1 : 0;

    await this.pageRepository.save(page);

    return this.mapToResult(page);
  }

  private async validateNoCircularReference(
    pageId: string,
    newParentId: string,
  ): Promise<void> {
    // Walk up the ancestor chain to check if pageId appears
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId !== null) {
      // Detect infinite loop
      if (visited.has(currentId)) {
        throw new CircularReferenceError();
      }
      visited.add(currentId);

      // Check if we've reached the page being moved
      if (currentId === pageId) {
        throw new CircularReferenceError();
      }

      // Get parent of current page
      const current = await this.pageRepository.findOne({
        where: { id: currentId },
        select: ['id', 'parentId'],
      });

      if (!current) {
        break;
      }

      currentId = current.parentId ?? null;
    }
  }

  private mapToResult(page: WikiPageEntity): PageResult {
    return {
      id: page.id,
      title: page.title,
      content: page.content,
      author: page.author,
      tags: (page.tags || []).map((tag) => this.mapTagToResult(tag)),
      parentId: page.parentId ?? null,
      order: page.order,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private mapToSummary(page: WikiPageEntity): PageSummaryResult {
    return {
      id: page.id,
      title: page.title,
      author: page.author,
      tags: (page.tags || []).map((tag) => this.mapTagToResult(tag)),
      parentId: page.parentId ?? null,
      order: page.order,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private mapTagToResult(tag: WikiTagEntity): TagResult {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  /**
   * Helper method to find or create tags by name (case-insensitive)
   */
  private async findOrCreateTags(tagNames: string[]): Promise<WikiTagEntity[]> {
    const tags: WikiTagEntity[] = [];

    for (const tagName of tagNames) {
      const normalizedName = tagName.trim();
      if (!normalizedName) continue;

      // Try to find existing tag (case-insensitive due to NOCASE collation)
      let tag = await this.tagRepository.findOne({
        where: { name: normalizedName }
      });

      if (!tag) {
        // Create new tag with normalized name and random color
        tag = this.tagRepository.create({
          name: normalizedName,
          color: getRandomTagColor(),
        });
        tag = await this.tagRepository.save(tag);
        this.logger.log({
          message: 'Tag created',
          tagId: tag.id,
          tagName: tag.name,
          color: tag.color,
        });
      }

      tags.push(tag);
    }

    return tags;
  }
}
