import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { TagEntity } from './tag.entity';
import { TAG_COLOR_PALETTE } from './tag-color-palette';
import { isSystemTagName } from './system-tags';

/**
 * Tag writes that must participate in a caller-owned transaction.
 */
@Injectable()
export class TransactionalTagWriterService {
  async findOrCreate(
    manager: EntityManager,
    tagNames: string[],
  ): Promise<TagEntity[]> {
    const names = [...new Set(tagNames.map((name) => name.trim()))].filter(
      Boolean,
    );
    const tags: TagEntity[] = [];

    for (const name of names) {
      const tagRepository = manager.getRepository(TagEntity);
      let tag = await tagRepository.findOne({
        where: { name },
        withDeleted: true,
      });

      if (tag?.deletedAt) {
        await tagRepository.delete(tag.id);
        tag = null;
      }

      if (!tag) {
        try {
          tag = await tagRepository.save(
            tagRepository.create({
              name,
              color: this.randomColor(),
            }),
          );
        } catch (error) {
          // The name column is case-insensitively unique. A competing command
          // may have inserted it after our lookup, so read the canonical row.
          tag = await tagRepository.findOne({ where: { name } });
          if (!tag) {
            throw error;
          }
        }
      }

      if (tag.name.startsWith('project:')) {
        await this.ensureProject(manager, tag);
      }
      tags.push(tag);
    }

    return tags;
  }

  async incrementUsage(
    manager: EntityManager,
    tagIds: string[],
  ): Promise<void> {
    const now = new Date().toISOString();
    for (const tagId of tagIds) {
      await manager.query(
        `
          INSERT INTO tag_usage (id, tag_id, usage_count, last_used_at, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?, ?)
          ON CONFLICT(tag_id) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used_at = excluded.last_used_at,
            updated_at = excluded.updated_at
        `,
        [randomUUID(), tagId, now, now, now],
      );
    }
  }

  async cleanupOrphaned(manager: EntityManager, tagId: string): Promise<void> {
    const tagRepository = manager.getRepository(TagEntity);
    const tag = await tagRepository.findOne({ where: { id: tagId } });
    if (!tag || isSystemTagName(tag.name)) return;

    const rows = (await manager.query(
      `
        SELECT COUNT(*) AS count FROM task_tags WHERE tag_id = ?
        UNION ALL SELECT COUNT(*) AS count FROM context_block_tags WHERE tag_id = ?
        UNION ALL SELECT COUNT(*) AS count FROM thread_tags WHERE tag_id = ?
        UNION ALL SELECT COUNT(*) AS count FROM task_blueprint_tags WHERE tag_id = ?
      `,
      [tagId, tagId, tagId, tagId],
    )) as Array<{ count: number | string }>;
    if (rows.every((row) => Number(row.count) === 0)) {
      await tagRepository.delete(tagId);
    }
  }

  private async ensureProject(
    manager: EntityManager,
    tag: TagEntity,
  ): Promise<void> {
    const slug = tag.name.slice('project:'.length).trim();
    if (!slug) return;

    const projectRepository = manager.getRepository(ProjectEntity);
    const existingProject = await projectRepository.findOne({
      where: { tagId: tag.id },
    });
    if (!existingProject) {
      await projectRepository.insert({ tagId: tag.id, slug });
    }
  }

  private randomColor(): string {
    return TAG_COLOR_PALETTE[
      Math.floor(Math.random() * TAG_COLOR_PALETTE.length)
    ];
  }
}
