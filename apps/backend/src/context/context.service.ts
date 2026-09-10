import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import JSZip from 'jszip';
import { ContextBlockEntity } from './block.entity';
import { MetaService } from '../meta/meta.service';
import { TagEntity } from '../meta/tag.entity';
import { ThreadsService } from '../threads/threads.service';
import { SearchService } from '../search/search.service';

import {
  AddTagInput,
  AppendBlockInput,
  CreateBlockInput,
  ListBlocksInput,
  BlockResult,
  BlockSummaryResult,
  BlockTreeResult,
  TagResult,
  UpdateBlockInput,
  SearchBlocksInput,
  BlockSearchResult,
} from './dto/service/context.service.types';
import {
  BlockNotFoundError,
  ParentBlockNotFoundError,
  CircularReferenceError,
  BlockIsThreadStateError,
  InvalidContextArchiveError,
  BlockHasChildrenError,
} from './errors/context.errors';
import {
  BlockCreatedEvent,
  BlockUpdatedEvent,
  BlockDeletedEvent,
} from './events/context.events';

interface ArchiveDirectory {
  name: string;
  directories: Map<string, ArchiveDirectory>;
  files: Map<string, string>;
}

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  private static readonly ROOT_PARENT_KEY = '__root__';

  constructor(
    @InjectRepository(ContextBlockEntity)
    private readonly blockRepository: Repository<ContextBlockEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly metaService: MetaService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
    private readonly searchService: SearchService,
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
      const whereClause =
        input.parentId === null
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
      const tags = await this.metaService.findOrCreateTagEntities(
        input.tagNames,
      );
      saved.tags = tags;
      await this.blockRepository.save(saved);

      // Increment usage tracking for all tags
      await this.metaService.incrementTagsUsage(tags.map((t) => t.id));
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

    // Emit domain event with actor information
    this.eventEmitter.emit(
      BlockCreatedEvent.INTERNAL,
      new BlockCreatedEvent(blockWithTags!, { id: input.createdByActorId }),
    );

    return this.mapToResult(blockWithTags!);
  }

  async listBlocks(input?: ListBlocksInput): Promise<BlockSummaryResult[]> {
    this.logger.log({
      message: 'Listing context blocks',
      filters: {
        tag: input?.tag,
        createdByActorId: input?.createdByActorId,
        parentId: input?.parentId,
        updatedAfter: input?.updatedAfter,
        limit: input?.limit,
      }
    });

    // Use query builder for complex filtering
    let queryBuilder = this.blockRepository
      .createQueryBuilder('block')
      .leftJoinAndSelect('block.tags', 'tags')
      .leftJoinAndSelect('block.createdByActor', 'createdByActor')
      .leftJoinAndSelect('block.assigneeActor', 'assigneeActor');

    // Apply tag filter if provided
    if (input?.tag) {
      queryBuilder = queryBuilder
        .innerJoin('block.tags', 'filterTag')
        .andWhere('filterTag.name = :tagName', { tagName: input.tag });
    }

    // Apply createdByActorId filter if provided
    if (input?.createdByActorId) {
      queryBuilder = queryBuilder.andWhere('block.createdByActorId = :createdByActorId', {
        createdByActorId: input.createdByActorId,
      });
    }

    // Apply parentId filter if provided (including explicit null)
    if (input?.parentId !== undefined) {
      if (input.parentId === null) {
        queryBuilder = queryBuilder.andWhere('block.parentId IS NULL');
      } else {
        queryBuilder = queryBuilder.andWhere('block.parentId = :parentId', {
          parentId: input.parentId,
        });
      }
    }

    // Apply updatedAfter filter if provided
    if (input?.updatedAfter) {
      queryBuilder = queryBuilder.andWhere('block.updatedAt >= :updatedAfter', {
        updatedAfter: input.updatedAfter,
      });
    }

    // Apply ordering
    queryBuilder = queryBuilder.orderBy('block.createdAt', 'DESC');

    // Apply limit if provided
    if (input?.limit) {
      queryBuilder = queryBuilder.take(input.limit);
    }

    const blocks = await queryBuilder.getMany();

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
        block.tags = await this.metaService.findOrCreateTagEntities(
          input.tagNames,
        );
      }
    }

    const saved = await this.blockRepository.save(block);

    // Reload with relations
    const blockWithTags = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    this.logger.log({ message: 'Context block.updated', blockId: saved.id });

    // Emit domain event with actor information
    // Use actorId from input if provided, otherwise fall back to the block's creator
    const actorId = input.actorId ?? blockWithTags!.createdByActorId;
    this.eventEmitter.emit(
      BlockUpdatedEvent.INTERNAL,
      new BlockUpdatedEvent(blockWithTags!, { id: actorId }),
    );

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

    block.content = `${block.content}\n${input.content}`;

    const saved = await this.blockRepository.save(block);

    this.logger.log({
      message: 'Context block content appended',
      blockId: saved.id,
    });

    // Emit domain event (appending is an update)
    // Use actorId from input if provided, otherwise fall back to the block's creator
    const actorId = input.actorId ?? saved.createdByActorId;
    this.eventEmitter.emit(
      BlockUpdatedEvent.INTERNAL,
      new BlockUpdatedEvent(saved, { id: actorId }),
    );

    return this.mapToResult(saved);
  }

  async deleteBlock(blockId: string, actorId?: string): Promise<void> {
    this.logger.log({ message: 'Deleting context block', blockId });

    // Get block first to retrieve creator actorId if none provided
    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      select: ['id', 'createdByActorId'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    // Check if block has children
    const children = await this.blockRepository.find({
      where: { parentId: blockId },
      select: ['id'],
    });

    if (children.length > 0) {
      throw new BlockHasChildrenError(blockId, children.length);
    }

    // Check if block is a state block for any threads
    const threadsWithState = await this.threadsService.findThreadsByStateBlockId(blockId);
    if (threadsWithState.length > 0) {
      throw new BlockIsThreadStateError(blockId, threadsWithState.length);
    }

    const result = await this.blockRepository.delete(blockId);

    if (!result.affected) {
      throw new BlockNotFoundError(blockId);
    }

    this.logger.log({ message: 'Context block.deleted', blockId });

    // Emit domain event with actor information
    // Use provided actorId or fall back to the block's creator
    const eventActorId = actorId ?? block.createdByActorId;
    this.eventEmitter.emit(
      BlockDeletedEvent.INTERNAL,
      new BlockDeletedEvent(blockId, { id: eventActorId }),
    );
  }

  async addTagToBlock(
    blockId: string,
    input: AddTagInput,
    actorId: string,
  ): Promise<BlockResult> {
    this.logger.log({
      message: 'Adding tag to block',
      blockId,
      tagName: input.name,
    });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    // Find or create the tag using MetaService
    const tag = await this.metaService.findOrCreateTagEntity(input.name);

    // Add tag to block if not already present
    if (!block.tags.some((t) => t.id === tag.id)) {
      block.tags.push(tag);
      await this.blockRepository.save(block);

      // Increment tag usage tracking
      await this.metaService.incrementTagUsage(tag.id);

      this.logger.log({
        message: 'Tag added to block',
        blockId,
        tagId: tag.id,
      });
    }

    // Reload with relations
    const blockWithRelations = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    // Emit domain event (tag changes are updates)
    this.eventEmitter.emit(
      BlockUpdatedEvent.INTERNAL,
      new BlockUpdatedEvent(blockWithRelations!, { id: actorId }),
    );

    return this.mapToResult(blockWithRelations!);
  }

  async removeTagFromBlock(
    blockId: string,
    tagId: string,
    actorId?: string,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Removing tag from block', blockId, tagId });

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });

    if (!block) {
      throw new BlockNotFoundError(blockId);
    }

    block.tags = block.tags.filter((tag) => tag.id !== tagId);
    await this.blockRepository.save(block);

    this.logger.log({ message: 'Tag removed from block', blockId, tagId });

    // Check if tag is now orphaned and clean it up using MetaService
    await this.metaService.cleanupOrphanedTag(tagId);

    // Emit domain event (tag changes are updates)
    // Use provided actorId or fall back to the block's creator
    const eventActorId = actorId ?? block.createdByActorId;
    this.eventEmitter.emit(
      BlockUpdatedEvent.INTERNAL,
      new BlockUpdatedEvent(block, { id: eventActorId }),
    );

    return this.mapToResult(block);
  }

  async getChildBlocks(parentId: string | null): Promise<BlockSummaryResult[]> {
    this.logger.log({ message: 'Fetching child pages', parentId });

    const whereClause =
      parentId === null ? { parentId: null as any } : { parentId };

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
    const whereClause =
      newParentId === null
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

  async searchBlocks(input: SearchBlocksInput): Promise<BlockSearchResult[]> {
    this.logger.log({
      message: 'Searching context blocks',
      query: input.query,
      limit: input.limit,
      threshold: input.threshold,
    });

    // Get all blocks - we need to search across all of them
    const blocks = await this.blockRepository.find();

    // Map blocks to searchable format
    const searchableItems = blocks.map((block) => ({
      id: block.id,
      title: block.title,
      content: block.content,
    }));

    // Use the generic search service
    // Primary field is 'title', secondary is 'content'
    const searchResults = this.searchService.search({
      items: searchableItems,
      primaryField: 'title',
      secondaryField: 'content',
      query: input.query,
      limit: input.limit,
      threshold: input.threshold,
    });

    this.logger.log({
      message: 'Search completed',
      resultCount: searchResults.length,
    });

    // Map search results to our output format
    return searchResults.map((result) => ({
      id: result.id,
      title: result.primaryField,
      score: result.score,
    }));
  }

  async exportBlocksAsZip(): Promise<Buffer> {
    this.logger.log({ message: 'Exporting context blocks to zip archive' });

    const allBlocks = await this.blockRepository.find({
      order: { order: 'ASC', createdAt: 'ASC' },
    });

    const childrenByParentId = new Map<string, ContextBlockEntity[]>();
    for (const block of allBlocks) {
      const key = block.parentId ?? ContextService.ROOT_PARENT_KEY;
      const siblings = childrenByParentId.get(key) ?? [];
      siblings.push(block);
      childrenByParentId.set(key, siblings);
    }

    const zip = new JSZip();
    const rootFolderName = this.createArchiveRootFolderName();
    this.addBlocksToArchive(
      zip,
      `${rootFolderName}/`,
      childrenByParentId,
      ContextService.ROOT_PARENT_KEY,
    );

    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    this.logger.log({
      message: 'Exported context blocks to zip archive',
      bytes: archive.byteLength,
      blockCount: allBlocks.length,
    });

    return archive;
  }

  async importBlocksFromZip(
    archiveBuffer: Buffer,
    createdByActorId: string,
  ): Promise<{ importedCount: number }> {
    this.logger.log({ message: 'Importing context blocks from zip archive' });

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(archiveBuffer);
    } catch {
      throw new InvalidContextArchiveError();
    }
    const root = this.createArchiveDirectory('');

    for (const [rawPath, entry] of Object.entries(zip.files)) {
      if (entry.dir) {
        continue;
      }

      const normalizedPath = rawPath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      const parts = normalizedPath.split('/').filter(Boolean);
      if (parts.length === 0 || this.shouldIgnoreArchivePath(parts)) {
        continue;
      }

      const fileName = parts.pop();
      if (!fileName) {
        continue;
      }

      if (!fileName.toLowerCase().endsWith('.md')) {
        continue;
      }

      let currentDirectory = root;
      for (const part of parts) {
        let childDirectory = currentDirectory.directories.get(part);
        if (!childDirectory) {
          childDirectory = this.createArchiveDirectory(part);
          currentDirectory.directories.set(part, childDirectory);
        }
        currentDirectory = childDirectory;
      }

      const content = await entry.async('string');
      currentDirectory.files.set(fileName, content);
    }

    const importRoot = this.resolveImportRootDirectory(root);
    const importedCount = await this.importArchiveDirectory(importRoot, null, createdByActorId);

    this.logger.log({
      message: 'Imported context blocks from zip archive',
      importedCount,
    });

    return { importedCount };
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

  private addBlocksToArchive(
    zip: JSZip,
    currentPath: string,
    childrenByParentId: Map<string, ContextBlockEntity[]>,
    parentIdKey: string,
  ): void {
    const siblings = (childrenByParentId.get(parentIdKey) ?? []).slice();
    siblings.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const usedNames = new Set<string>();
    for (const block of siblings) {
      const sanitizedTitle = this.sanitizeNameForFs(block.title);
      const uniqueBaseName = this.makeUniqueName(usedNames, sanitizedTitle);
      const childKey = block.id;
      const children = childrenByParentId.get(childKey) ?? [];

      if (children.length > 0) {
        const folderPath = `${currentPath}${uniqueBaseName}/`;
        zip.file(`${folderPath}index.md`, block.content ?? '');
        this.addBlocksToArchive(zip, folderPath, childrenByParentId, childKey);
      } else {
        zip.file(`${currentPath}${uniqueBaseName}.md`, block.content ?? '');
      }
    }
  }

  private createArchiveDirectory(name: string): ArchiveDirectory {
    return {
      name,
      directories: new Map<string, ArchiveDirectory>(),
      files: new Map<string, string>(),
    };
  }

  private createArchiveRootFolderName(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `context-blocks-${timestamp}`;
  }

  private resolveImportRootDirectory(root: ArchiveDirectory): ArchiveDirectory {
    if (root.files.size > 0 || root.directories.size !== 1) {
      return root;
    }

    const [directoryName, directory] = [...root.directories.entries()][0];
    const normalizedName = directoryName.toLowerCase();
    const isExpectedArchiveRoot =
      normalizedName === 'context-blocks' || normalizedName.startsWith('context-blocks-');
    if (!isExpectedArchiveRoot) {
      return root;
    }

    const hasIndexFile = [...directory.files.keys()].some(
      (fileName) => fileName.toLowerCase() === 'index.md',
    );
    if (hasIndexFile) {
      return root;
    }

    return directory;
  }

  private async importArchiveDirectory(
    directory: ArchiveDirectory,
    parentId: string | null,
    createdByActorId: string,
  ): Promise<number> {
    let importedCount = 0;

    const leafFiles = [...directory.files.entries()]
      .filter(([fileName]) => fileName.toLowerCase() !== 'index.md')
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [fileName, content] of leafFiles) {
      const title = this.extractTitleFromMarkdownFileName(fileName);
      await this.createBlock({
        title,
        content,
        createdByActorId,
        parentId,
      });
      importedCount += 1;
    }

    const childDirectories = [...directory.directories.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    );

    for (const [directoryName, childDirectory] of childDirectories) {
      const indexEntry = [...childDirectory.files.entries()].find(
        ([fileName]) => fileName.toLowerCase() === 'index.md',
      );
      const content = indexEntry?.[1] ?? '.';

      const block = await this.createBlock({
        title: this.normalizeImportedTitle(directoryName),
        content,
        createdByActorId,
        parentId,
      });
      importedCount += 1;

      importedCount += await this.importArchiveDirectory(
        childDirectory,
        block.id,
        createdByActorId,
      );
    }

    return importedCount;
  }

  private sanitizeNameForFs(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'untitled';
    }

    const sanitized = trimmed
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim();

    return sanitized || 'untitled';
  }

  private makeUniqueName(usedNames: Set<string>, baseName: string): string {
    if (!usedNames.has(baseName)) {
      usedNames.add(baseName);
      return baseName;
    }

    let suffix = 2;
    let candidate = `${baseName} (${suffix})`;
    while (usedNames.has(candidate)) {
      suffix += 1;
      candidate = `${baseName} (${suffix})`;
    }
    usedNames.add(candidate);
    return candidate;
  }

  private extractTitleFromMarkdownFileName(fileName: string): string {
    if (!fileName.toLowerCase().endsWith('.md')) {
      return this.normalizeImportedTitle(fileName);
    }

    const baseName = fileName.slice(0, -3);
    return this.normalizeImportedTitle(baseName);
  }

  private normalizeImportedTitle(name: string): string {
    const normalized = name.trim();
    return normalized.length > 0 ? normalized : 'untitled';
  }

  private shouldIgnoreArchivePath(pathParts: string[]): boolean {
    return pathParts.some((part) => this.isIgnoredArchiveSegment(part));
  }

  private isIgnoredArchiveSegment(segment: string): boolean {
    const normalized = segment.trim().toLowerCase();
    return (
      normalized.length === 0 ||
      normalized === '__macosx' ||
      normalized === '.ds_store' ||
      normalized === 'thumbs.db' ||
      normalized.startsWith('._')
    );
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

  private mapTagToResult(tag: TagEntity): TagResult {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
