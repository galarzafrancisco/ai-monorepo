import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import JSZip from 'jszip';
import { ContextBlockEntity } from './block.entity';
import { TagEntity } from '../meta/tag.entity';
import { SearchService } from '../search/search.service';
import { CreateContextBlockUseCase } from './use-cases/create-context-block.use-case';
import { UpdateContextBlockUseCase } from './use-cases/update-context-block.use-case';
import { AppendContextBlockUseCase } from './use-cases/append-context-block.use-case';
import { DeleteContextBlockUseCase } from './use-cases/delete-context-block.use-case';
import { ChangeContextBlockTagUseCase } from './use-cases/change-context-block-tag.use-case';
import { MoveContextBlockUseCase } from './use-cases/move-context-block.use-case';
import {
  ContextBlockImportEntry,
  ImportContextBlockTreeUseCase,
} from './use-cases/import-context-block-tree.use-case';

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
  InvalidContextArchiveError,
} from './errors/context.errors';

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
    private readonly searchService: SearchService,
    private readonly createContextBlockUseCase: CreateContextBlockUseCase,
    private readonly updateContextBlockUseCase: UpdateContextBlockUseCase,
    private readonly appendContextBlockUseCase: AppendContextBlockUseCase,
    private readonly deleteContextBlockUseCase: DeleteContextBlockUseCase,
    private readonly changeContextBlockTagUseCase: ChangeContextBlockTagUseCase,
    private readonly moveContextBlockUseCase: MoveContextBlockUseCase,
    private readonly importContextBlockTreeUseCase: ImportContextBlockTreeUseCase,
  ) {}

  async createBlock(input: CreateBlockInput): Promise<BlockResult> {
    this.logger.log({
      message: 'Creating context block',
      title: input.title,
      author: input.createdByActorId,
    });

    const blockWithTags = await this.createContextBlockUseCase.execute(input);

    this.logger.log({
      message: 'Context block.created',
      blockId: blockWithTags.id,
    });

    return this.mapToResult(blockWithTags);
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
      },
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
      queryBuilder = queryBuilder.andWhere(
        'block.createdByActorId = :createdByActorId',
        {
          createdByActorId: input.createdByActorId,
        },
      );
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

    const blockWithTags = await this.updateContextBlockUseCase.execute(
      blockId,
      input,
    );

    this.logger.log({
      message: 'Context block.updated',
      blockId: blockWithTags.id,
    });
    return this.mapToResult(blockWithTags);
  }

  async appendToBlock(
    blockId: string,
    input: AppendBlockInput,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Appending context block content', blockId });

    const saved = await this.appendContextBlockUseCase.execute(blockId, input);

    this.logger.log({
      message: 'Context block content appended',
      blockId: saved.id,
    });

    return this.mapToResult(saved);
  }

  async deleteBlock(blockId: string, actorId?: string): Promise<void> {
    this.logger.log({ message: 'Deleting context block', blockId });

    await this.deleteContextBlockUseCase.execute(blockId, actorId);

    this.logger.log({ message: 'Context block.deleted', blockId });
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

    const block = await this.changeContextBlockTagUseCase.add(
      blockId,
      input.name,
      actorId,
    );
    return this.mapToResult(block);
  }

  async removeTagFromBlock(
    blockId: string,
    tagId: string,
    actorId?: string,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Removing tag from block', blockId, tagId });

    const block = await this.changeContextBlockTagUseCase.remove(
      blockId,
      tagId,
      actorId,
    );
    this.logger.log({ message: 'Tag removed from block', blockId, tagId });
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
    const block = await this.updateContextBlockUseCase.execute(blockId, {
      order: newOrder,
    });
    return this.mapToResult(block);
  }

  async moveBlock(
    blockId: string,
    newParentId: string | null,
  ): Promise<BlockResult> {
    this.logger.log({ message: 'Moving page', blockId, newParentId });

    const block = await this.moveContextBlockUseCase.execute(
      blockId,
      newParentId,
    );
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
    const importedCount = await this.importContextBlockTreeUseCase.execute(
      this.buildImportEntries(importRoot),
      createdByActorId,
    );

    this.logger.log({
      message: 'Imported context blocks from zip archive',
      importedCount,
    });

    return { importedCount };
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
      normalizedName === 'context-blocks' ||
      normalizedName.startsWith('context-blocks-');
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

  private buildImportEntries(
    directory: ArchiveDirectory,
    parentEntryIndex: number | null = null,
    entries: ContextBlockImportEntry[] = [],
  ): ContextBlockImportEntry[] {
    const leafFiles = [...directory.files.entries()]
      .filter(([fileName]) => fileName.toLowerCase() !== 'index.md')
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [fileName, content] of leafFiles) {
      const title = this.extractTitleFromMarkdownFileName(fileName);
      entries.push({
        title,
        content,
        parentEntryIndex,
      });
    }

    const childDirectories = [...directory.directories.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    );

    for (const [directoryName, childDirectory] of childDirectories) {
      const indexEntry = [...childDirectory.files.entries()].find(
        ([fileName]) => fileName.toLowerCase() === 'index.md',
      );
      const content = indexEntry?.[1] ?? '.';

      const entryIndex = entries.length;
      entries.push({
        title: this.normalizeImportedTitle(directoryName),
        content,
        parentEntryIndex,
      });
      this.buildImportEntries(childDirectory, entryIndex, entries);
    }
    return entries;
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
