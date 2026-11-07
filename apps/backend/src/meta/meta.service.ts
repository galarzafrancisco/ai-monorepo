import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TagEntity } from './tag.entity';
import { TagUsageEntity } from './tag-usage.entity';
import { ProjectEntity } from './project.entity';
import {
  CreateTagInput,
  TagResult,
  VersionResult,
} from './dto/service/meta.service.types';
import { SYSTEM_TAGS, isSystemTagName } from './system-tags';
import { WorkspacesService } from '../workspaces/workspaces.service';

/**
 * Predefined color palette for tags
 * Colors are chosen to be visually distinct and accessible
 */
export const TAG_COLOR_PALETTE = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B739', // Orange
  '#52B788', // Green
  '#E76F51', // Coral
  '#8E7CC3', // Lavender
  '#FF9FF3', // Pink
  '#54A0FF', // Bright Blue
  '#48DBFB', // Cyan
  '#1DD1A1', // Emerald
  '#FFA502', // Amber
  '#FF6348', // Tomato
  '#5F27CD', // Deep Purple
  '#00D2D3', // Turquoise
] as const;

@Injectable()
export class MetaService implements OnModuleInit {
  private readonly logger = new Logger(MetaService.name);

  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    @InjectRepository(TagUsageEntity)
    private readonly tagUsageRepository: Repository<TagUsageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async onModuleInit(): Promise<void> {
    // WorkspacesService (a dependency, so initialised first) has made sure
    // the default workspace exists.
    for (const workspaceId of await this.workspacesService.listWorkspaceIds()) {
      await this.ensureSystemTags(workspaceId);
    }
  }

  /** Creates the system tags in a workspace, or puts back their name and color. */
  async ensureSystemTags(workspaceId: string): Promise<void> {
    for (const systemTag of SYSTEM_TAGS) {
      const tag = await this.findOrCreateTagEntity(
        workspaceId,
        systemTag.name,
        systemTag.color,
      );
      if (tag.name !== systemTag.name || tag.color !== systemTag.color) {
        tag.name = systemTag.name;
        tag.color = systemTag.color;
        await this.tagRepository.save(tag);
      }
    }
  }

  /**
   * Returns a random color from the predefined palette
   */
  getRandomTagColor(): string {
    const randomIndex = Math.floor(Math.random() * TAG_COLOR_PALETTE.length);
    return TAG_COLOR_PALETTE[randomIndex];
  }

  /**
   * Returns all available tag colors
   */
  getTagColorPalette(): readonly string[] {
    return TAG_COLOR_PALETTE;
  }

  async createTag(
    workspaceId: string,
    input: CreateTagInput,
  ): Promise<TagResult> {
    this.logger.log({
      message: 'Creating tag',
      tagName: input.name,
    });
    const tag = await this.findOrCreateTagEntity(
      workspaceId,
      input.name,
      input.color,
    );
    return this.mapTagToResult(tag);
  }

  /**
   * Auto-create a project when a tag with 'project:' prefix is created
   */
  private async autoCreateProject(tag: TagEntity): Promise<void> {
    const slug = tag.name.replace('project:', '').trim();

    if (!slug) {
      this.logger.warn({
        message: 'Cannot create project: empty slug after removing prefix',
        tagName: tag.name,
      });
      return;
    }

    this.logger.log({
      message: 'Auto-creating project for tag',
      tagId: tag.id,
      slug,
    });

    // Check if project already exists
    const existingProject = await this.projectRepository.findOne({
      where: { workspaceId: tag.workspaceId, tagId: tag.id },
    });

    if (!existingProject) {
      const project = this.projectRepository.create({
        workspaceId: tag.workspaceId,
        tagId: tag.id,
        slug,
      });
      await this.projectRepository.save(project);

      this.logger.log({
        message: 'Project auto-created',
        projectId: project.id,
        slug,
      });
    }
  }

  async getAllTags(workspaceId: string): Promise<TagResult[]> {
    this.logger.log({ message: 'Getting all tags' });

    const [tags, usageRows] = await Promise.all([
      this.tagRepository.find({ where: { workspaceId } }),
      this.tagUsageRepository.find({ where: { workspaceId } }),
    ]);

    const usageByTagId = new Map(
      usageRows.map((usage) => [usage.tagId, usage] as const),
    );

    // Sort by: most recently used, then most frequently used, then alphabetically.
    const sortedTags = tags.sort((a, b) => {
      const aUsage = usageByTagId.get(a.id);
      const bUsage = usageByTagId.get(b.id);

      const aLastUsed = aUsage?.lastUsedAt
        ? new Date(aUsage.lastUsedAt).getTime()
        : 0;
      const bLastUsed = bUsage?.lastUsedAt
        ? new Date(bUsage.lastUsedAt).getTime()
        : 0;

      // Primary: Most recently used (DESC)
      if (aLastUsed !== bLastUsed) {
        return bLastUsed - aLastUsed;
      }

      // Secondary: Most frequently used (DESC)
      const aUsageCount = aUsage?.usageCount ?? 0;
      const bUsageCount = bUsage?.usageCount ?? 0;
      if (aUsageCount !== bUsageCount) {
        return bUsageCount - aUsageCount;
      }

      // Tertiary: Alphabetically by name (ASC)
      return a.name.localeCompare(b.name);
    });

    this.logger.log({
      message: 'Tags retrieved',
      count: sortedTags.length,
    });

    return sortedTags.map((tag) => this.mapTagToResult(tag));
  }

  async getTagById(
    workspaceId: string,
    tagId: string,
  ): Promise<TagResult | null> {
    const tag = await this.tagRepository.findOne({
      where: { workspaceId, id: tagId },
    });
    return tag ? this.mapTagToResult(tag) : null;
  }

  async deleteTag(workspaceId: string, tagId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting tag',
      tagId,
    });

    const tag = await this.tagRepository.findOne({
      where: { workspaceId, id: tagId },
    });

    if (!tag) {
      this.logger.warn({
        message: 'Tag not found for deletion',
        tagId,
      });
      return;
    }

    if (isSystemTagName(tag.name)) {
      this.logger.warn({
        message: 'System tag cannot be deleted',
        tagId,
        tagName: tag.name,
      });
      return;
    }

    // Deleting the membership tag directly would cascade the project and its
    // provenance without removing automatically applied task tags or notifying listeners.
    if (
      await this.projectRepository.exists({ where: { workspaceId, tagId } })
    ) {
      throw new BadRequestException(
        'Delete the project through the projects endpoint',
      );
    }

    const result = await this.tagRepository.delete({ workspaceId, id: tagId });

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

  /**
   * Get raw tag entities - for internal use by other modules that need entities.
   * Ids from another workspace are left out.
   */
  async getTagEntities(
    workspaceId: string,
    tagIds: string[],
  ): Promise<TagEntity[]> {
    if (tagIds.length === 0) return [];
    return this.tagRepository.findBy({ workspaceId, id: In(tagIds) });
  }

  /**
   * Find or create tag entities by name - for internal use by other modules
   */
  async findOrCreateTagEntities(
    workspaceId: string,
    tagNames: string[],
  ): Promise<TagEntity[]> {
    const tags: TagEntity[] = [];
    for (const tagName of tagNames) {
      if (!tagName.trim()) continue;
      tags.push(await this.findOrCreateTagEntity(workspaceId, tagName));
    }
    return tags;
  }

  /**
   * Find (case-insensitively) or create a single tag entity by name in a
   * workspace, with an optional color for a new tag.
   */
  async findOrCreateTagEntity(
    workspaceId: string,
    name: string,
    color?: string,
  ): Promise<TagEntity> {
    const normalizedName = name.trim();

    let tag = await this.tagRepository.findOne({
      where: {
        workspaceId,
        name: Raw((column) => `lower(${column}) = lower(:name)`, {
          name: normalizedName,
        }),
      },
      withDeleted: true,
    });

    if (tag?.deletedAt) {
      await this.tagRepository.delete({ workspaceId, id: tag.id });
      tag = null;
    }

    if (!tag) {
      tag = this.tagRepository.create({
        workspaceId,
        name: normalizedName,
        color: color ?? this.getRandomTagColor(),
      });
      tag = await this.tagRepository.save(tag);
      this.logger.log({
        message: 'Tag created',
        tagId: tag.id,
        tagName: tag.name,
        color: tag.color,
      });

      // Auto-create project if tag starts with 'project:'
      if (tag.name.startsWith('project:')) {
        await this.autoCreateProject(tag);
      }
    }

    return tag;
  }

  /**
   * Check if a tag is orphaned (no tasks or blocks reference it)
   * and delete it if so
   */
  async cleanupOrphanedTag(workspaceId: string, tagId: string): Promise<void> {
    this.logger.log({
      message: 'Checking if tag is orphaned',
      tagId,
    });

    const tagWithRelations = await this.tagRepository.findOne({
      where: { workspaceId, id: tagId },
      relations: ['tasks', 'blocks'],
    });

    if (!tagWithRelations) {
      this.logger.warn({
        message: 'Tag not found for cleanup check',
        tagId,
      });
      return;
    }

    if (isSystemTagName(tagWithRelations.name)) {
      this.logger.log({
        message: 'System tag kept during orphan cleanup',
        tagId,
        tagName: tagWithRelations.name,
      });
      return;
    }

    const taskCount = tagWithRelations.tasks?.length || 0;
    const blockCount = tagWithRelations.blocks?.length || 0;

    if (taskCount === 0 && blockCount === 0) {
      // A configured auto tag must survive even when no task currently uses it.
      const configured: unknown[] = await this.tagRepository.query(
        'SELECT 1 FROM project_auto_tags WHERE tag_id = $1 LIMIT 1',
        [tagId],
      );
      if (configured.length > 0) return;

      // A project's tag outlives its tasks: deleting it would cascade to the project
      // (description, repository) just because its last task moved elsewhere.
      const project = await this.projectRepository.findOne({
        where: { workspaceId, tagId },
      });
      if (project) {
        this.logger.log({
          message: 'Project tag kept during orphan cleanup',
          tagId,
          projectId: project.id,
        });
        return;
      }

      this.logger.log({
        message: 'Tag is orphaned, cleaning up',
        tagId,
        tagName: tagWithRelations.name,
      });

      await this.tagRepository.delete({ workspaceId, id: tagId });

      this.logger.log({
        message: 'Orphaned tag cleaned up',
        tagId,
      });
    } else {
      this.logger.log({
        message: 'Tag still in use, keeping it',
        tagId,
        taskCount,
        blockCount,
      });
    }
  }

  /**
   * Increment usage count and update last used timestamp for a tag
   * Uses upsert to handle concurrent updates atomically
   * @param tagId - ID of the tag to track usage for
   */
  async incrementTagUsage(workspaceId: string, tagId: string): Promise<void> {
    this.logger.log({
      message: 'Incrementing tag usage',
      tagId,
    });

    const now = new Date().toISOString();

    // Use PostgreSQL INSERT ... ON CONFLICT to handle concurrent updates atomically
    // This prevents duplicate rows and race conditions. The SELECT only
    // inserts when the tag is in the workspace.
    await this.tagUsageRepository.query(
      `
      INSERT INTO tag_usage (id, workspace_id, tag_id, usage_count, last_used_at, created_at, updated_at)
      SELECT $1, t.workspace_id, t.id, 1, $3, $4, $5
      FROM tags t
      WHERE t.id = $2 AND t.workspace_id = $6
      ON CONFLICT(tag_id) DO UPDATE SET
        usage_count = tag_usage.usage_count + 1,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at
      `,
      [randomUUID(), tagId, now, now, now, workspaceId],
    );

    this.logger.log({
      message: 'Tag usage updated',
      tagId,
    });
  }

  /**
   * Batch increment usage for multiple tags
   * @param tagIds - Array of tag IDs to track usage for
   */
  async incrementTagsUsage(
    workspaceId: string,
    tagIds: string[],
  ): Promise<void> {
    if (tagIds.length === 0) return;

    this.logger.log({
      message: 'Batch incrementing tag usage',
      tagCount: tagIds.length,
    });

    for (const tagId of tagIds) {
      await this.incrementTagUsage(workspaceId, tagId);
    }
  }

  /**
   * Get version information for backend and UI
   */
  getVersion(): VersionResult {
    this.logger.log({ message: 'Getting version information' });

    try {
      // Read backend version from package.json
      // In production (dist), this will be at dist/package.json (copied during build)
      // In development, this will be at src/../package.json
      const backendPackageJson = JSON.parse(
        readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
      );
      const backendVersion = backendPackageJson.version;

      // Read UI version from UI package.json
      // Path depends on whether we're in dev or prod:
      // - Prod (running from dist/meta): __dirname is dist/meta, so ../public/package.json resolves to dist/public/package.json
      // - Dev (running from src/meta): __dirname is src/meta, so ../../ui/package.json resolves to apps/ui/package.json
      let uiVersion = backendVersion; // Fallback to backend version

      try {
        // First try production path (dist/public/package.json)
        const uiPackageJsonPath = join(__dirname, '../public/package.json');
        const uiPackageJson = JSON.parse(
          readFileSync(uiPackageJsonPath, 'utf-8'),
        );
        uiVersion = uiPackageJson.version;
      } catch {
        // If not found, try development path
        try {
          const uiDevPackageJsonPath = join(
            __dirname,
            '../../../ui/package.json',
          );
          const uiPackageJson = JSON.parse(
            readFileSync(uiDevPackageJsonPath, 'utf-8'),
          );
          uiVersion = uiPackageJson.version;
        } catch {
          // If still not found, use backend version as fallback
          this.logger.warn(
            'Could not read UI package.json, using backend version as fallback',
          );
        }
      }

      return {
        backend: backendVersion,
        ui: uiVersion,
      };
    } catch (error) {
      this.logger.error('Error reading version information', error);
      return {
        backend: 'unknown',
        ui: 'unknown',
      };
    }
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
