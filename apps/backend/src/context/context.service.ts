import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContextBlockEntity } from './block.entity';
import { ContextTagEntity } from './tag.entity';
import {
  AddTagInput,
  AppendBlockInput,
  CreateBlockInput,
  CreateTagInput,
  ListBlocksInput,
  BlockResult,
  BlockSummaryResult,
  BlockTreeResult,
  TagResult,
  UpdateBlockInput,
} from './dto/service/context.service.types';
import {
  BlockNotFoundError,
  ParentBlockNotFoundError,
  CircularReferenceError,
} from './errors/context.errors';
import { getRandomTagColor } from '../common/utils/color-palette.util';
import {
  BlockCreatedEvent,
  BlockUpdatedEvent,
  BlockDeletedEvent,
} from './events/context.events';

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    @InjectRepository(ContextBlockEntity)
    private readonly blockRepository: Repository<ContextBlockEntity>,
    @InjectRepository(ContextTagEntity)
    private readonly tagRepository: Repository<ContextTagEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createBlock(input: CreateBlockInput): Promise<BlockResult> {
    this.logger.log({
      message: 'Creating context block',
      title: input.title,
      author: input.createdByActorId,
    });

    // Validate parent exists if provided
    if (input.parentId) {
      const parent = await this.blockRepository.findOne({
        where: { id: input.parentId },
      });
      if (!parent) {
        throw new ParentBlockNotFoundError(input.parentId);
      }
    }

    // Calculate default order (max sibling order + 1)
    let order = 0;
    if (input.parentId !== undefined) {
      const whereClause = input.parentId === null
        ? { parentId: null as any }
        : { parentId: input.parentId };

      const siblings = await this.blockRepository.find({
        where: whereClause,
        order: { order: 'DESC' },
        take: 1,
      });
      if (siblings.length > 0) {
        order = siblings[0].order + 1;
      }
    }

    const block = this.blockRepository.create({
      title: input.title,
      content: input.content,
      createdByActorId: input.createdByActorId,
      parentId: input.parentId,
      order,
      tags: [],
    });

    const saved = await this.blockRepository.save(block);

    // Handle tags if provided
    if (input.tagNames && input.tagNames.length > 0) {
      const tags = await this.findOrCreateTags(input.tagNames);
      saved.tags = tags;
      await this.blockRepository.save(saved);
    }

    // Reload with relations
    const blockWithTags = await this.blockRepository.findOne({
      where: { id: saved.id },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    this.logger.log({
      message: 'Context block.created',
      blockId: saved.id,
    });

    // Emit block.created event
    this.eventEmitter.emit('block.created', new BlockCreatedEvent(blockWithTags!));

    return this.mapToResult(blockWithTags!);
  }

  async listBlocks(input?: ListBlocksInput): Promise<BlockSummaryResult[]> {
    this.logger.log({ message: 'Listing context blocks', tag: input?.tag });

    // If tag filter is provided, use query builder for join
    if (input?.tag) {
      const blocks = await this.blockRepository
        .createQueryBuilder('block')
        .leftJoinAndSelect('block.tags', 'tags')
        .leftJoinAndSelect('block.createdByActor', 'createdByActor')
        .innerJoin('block.tags', 'filterTag')
        .where('filterTag.name = :tagName', { tagName: input.tag })
        .orderBy('block.createdAt', 'DESC')
        .getMany();

      return blocks.map((block) => this.mapToSummary(block));
    }

    // Standard filtering without tags
    const blocks = await this.blockRepository.find({
      relations: ['tags', 'createdByActor', 'assigneeActor'],
      order: { createdAt: 'DESC' },
    });

    return blocks.map((block) => this.mapToSummary(block));
  }

  async getBlockById(blockId: string): Promise<BlockResult> {
    this.logger.log({ message: 'Fetching context block', blockId });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    return this.mapToResult(block);
  }

  async updateBlock(
    blockId: string,
    input: UpdateBlockInput,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Updating context block', blockId });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    // Validate parent changes
    if (input.parentId !== undefined) {
      // Prevent self-reference
      if (input.parentId === blockId) {
        throw new CircularReferenceError();
      }

      // Validate parent exists if not null
      if (input.parentId !== null) {
        const parent = await this.blockRepository.findOne({
          where: { id: input.parentId },
        });
        if (!parent) {
          throw new ParentBlockNotFoundError(input.parentId);
        }

        // Check for circular reference
        await this.validateNoCircularReference(blockId, input.parentId);
      }

      block.parentId = input.parentId;
    }

    if (input.title !== undefined) {
      block.title = input.title;
    }
    if (input.content !== undefined) {
      block.content = input.content;
    }
    if (input.order !== undefined) {
      block.order = input.order;
    }

    // Handle tags if provided
    if (input.tagNames !== undefined) {
      if (input.tagNames.length === 0) {
        block.tags = [];
      } else {
        block.tags = await this.findOrCreateTags(input.tagNames);
      }
    }

    const saved = await this.blockRepository.save(block);

    // Reload with relations
    const blockWithTags = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    this.logger.log({ message: 'Context block.updated', blockId: saved.id });

    // Emit block.updated event
    this.eventEmitter.emit('block.updated', new BlockUpdatedEvent(blockWithTags!));

    return this.mapToResult(blockWithTags!);
  }

  async appendToBlock(
    blockId: string,
    input: AppendBlockInput,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Appending context block content', blockId });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    block.content = `${block.content}${input.content}`;

    const saved = await this.blockRepository.save(block);

    this.logger.log({ message: 'Context block content appended', blockId: saved.id });

    // Emit block.updated event (appending is an update)
    this.eventEmitter.emit('block.updated', new BlockUpdatedEvent(saved));

    return this.mapToResult(saved);
  }

  async deleteBlock(blockId: string): Promise<void> {
    this.logger.log({ message: 'Deleting context block', blockId });

    const result = await this.blockRepository.delete(blockId);

    if (!result.affected) {
      throw new BlockNotFoundError(blockId);
    }

    this.logger.log({ message: 'Context block.deleted', blockId });

    // Emit block.deleted event
    this.eventEmitter.emit('block.deleted', new BlockDeletedEvent(blockId));
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

  async addTagToBlock(blockId: string, input: AddTagInput): Promise<BlockResult> {
    this.logger.log({ message: 'Adding tag to page', blockId, tagName: input.name });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
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

    // Add tag to block if not already present
    if (!block.tags.some((t) => t.id === tag.id)) {
      block.tags.push(tag);
      await this.blockRepository.save(block);
    }

    // Reload with relations
    const pageWithRelations = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    this.logger.log({ message: 'Tag added to page', blockId, tagId: tag.id });

    // Emit block.updated event (tag changes are updates)
    this.eventEmitter.emit('block.updated', new BlockUpdatedEvent(pageWithRelations!));

    return this.mapToResult(pageWithRelations!);
  }

  async removeTagFromBlock(blockId: string, tagId: string): Promise<BlockResult> {
    this.logger.log({ message: 'Removing tag from page', blockId, tagId });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    block.tags = block.tags.filter((tag) => tag.id !== tagId);
    await this.blockRepository.save(block);

    this.logger.log({ message: 'Tag removed from page', blockId, tagId });

    // Check if tag is now orphaned and clean it up
    await this.cleanupOrphanedTag(tagId);

    // Emit block.updated event (tag changes are updates)
    this.eventEmitter.emit('block.updated', new BlockUpdatedEvent(block));

    return this.mapToResult(block);
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

    if (tagWithPages.blocks.length === 0) {
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
        pageCount: tagWithPages.blocks.length,
      });
    }
  }

  async getChildBlocks(parentId: string | null): Promise<BlockSummaryResult[]> {
    this.logger.log({ message: 'Fetching child pages', parentId });

    const whereClause = parentId === null
      ? { parentId: null as any }
      : { parentId };

    const children = await this.blockRepository.find({
      where: whereClause,
      relations: ['tags', 'createdByActor', 'assigneeActor'],
      order: { order: 'ASC' },
    });

    return children.map((block) => this.mapToSummary(block));
  }

  async getBlockTree(): Promise<BlockTreeResult[]> {
    this.logger.log({ message: 'Fetching block tree' });

    // Get all blocks with actor relations
    const allBlocks = await this.blockRepository.find({
      relations: ['createdByActor'],
      order: { order: 'ASC' },
    });

    // Build tree structure
    const blockMap = new Map<string, BlockTreeResult>();
    const rootBlocks: BlockTreeResult[] = [];

    // First pass: create all nodes
    for (const block of allBlocks) {
      blockMap.set(block.id, {
        id: block.id,
        title: block.title,
        createdByActorId: block.createdByActorId,
        createdBy: block.createdBy,
        parentId: block.parentId ?? null,
        order: block.order,
        children: [],
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      });
    }

    // Second pass: build tree
    for (const block of allBlocks) {
      const node = blockMap.get(block.id)!;
      if (block.parentId === null || block.parentId === undefined) {
        rootBlocks.push(node);
      } else {
        const parent = blockMap.get(block.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootBlocks.push(node);
        }
      }
    }

    return rootBlocks;
  }

  async reorderBlock(blockId: string, newOrder: number): Promise<BlockResult> {
    this.logger.log({ message: 'Reordering page', blockId, newOrder });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    block.order = newOrder;
    await this.blockRepository.save(block);

    return this.mapToResult(block);
  }

  async moveBlock(
    blockId: string,
    newParentId: string | null,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Moving page', blockId, newParentId });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    // Prevent self-reference
    if (newParentId === blockId) {
      throw new CircularReferenceError();
    }

    // Validate parent exists if not null
    if (newParentId !== null) {
      const parent = await this.blockRepository.findOne({
        where: { id: newParentId },
      });
      if (!parent) {
        throw new ParentBlockNotFoundError(newParentId);
      }

      // Check for circular reference
      await this.validateNoCircularReference(blockId, newParentId);
    }

    block.parentId = newParentId;

    // Calculate new order (append to end of siblings)
    const whereClause = newParentId === null
      ? { parentId: null as any }
      : { parentId: newParentId };

    const siblings = await this.blockRepository.find({
      where: whereClause,
      order: { order: 'DESC' },
      take: 1,
    });
    block.order = siblings.length > 0 ? siblings[0].order + 1 : 0;

    await this.blockRepository.save(block);

    return this.mapToResult(block);
  }

  private async validateNoCircularReference(
    blockId: string,
    newParentId: string,
  ): Promise<void> {
    // Walk up the ancestor chain to check if blockId appears
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId !== null) {
      // Detect infinite loop
      if (visited.has(currentId)) {
        throw new CircularReferenceError();
      }
      visited.add(currentId);

      // Check if we've reached the block being moved
      if (currentId === blockId) {
        throw new CircularReferenceError();
      }

      // Get parent of current page
      const current = await this.blockRepository.findOne({
        where: { id: currentId },
        select: ['id', 'parentId'],
      });

      if (!current) {
        break;
      }

      currentId = current.parentId ?? null;
    }
  }

  private mapToResult(block: ContextBlockEntity): BlockResult {
    return {
      id: block.id,
      title: block.title,
      content: block.content,
      createdByActorId: block.createdByActorId,
      createdBy: block.createdBy,
      assigneeActorId: block.assigneeActorId,
      assignee: block.assignee,
      tags: (block.tags || []).map((tag) => this.mapTagToResult(tag)),
      parentId: block.parentId ?? null,
      order: block.order,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }

  private mapToSummary(block: ContextBlockEntity): BlockSummaryResult {
    return {
      id: block.id,
      title: block.title,
      createdByActorId: block.createdByActorId,
      createdBy: block.createdBy,
      tags: (block.tags || []).map((tag) => this.mapTagToResult(tag)),
      parentId: block.parentId ?? null,
      order: block.order,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }

  private mapTagToResult(tag: ContextTagEntity): TagResult {
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
  private async findOrCreateTags(tagNames: string[]): Promise<ContextTagEntity[]> {
    const tags: ContextTagEntity[] = [];

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
