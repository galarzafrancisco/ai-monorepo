import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Attribution = { project_id: string; tag_id: string; applied: boolean };
type Desired = { project_id: string; tag_id: string };

/** Keeps task tags and their project provenance in step when project membership changes. */
@Injectable()
export class ProjectAutoTagsService {
  constructor(private readonly dataSource: DataSource) {}

  async syncTask(taskId: string, manualTagIds: string[] = []): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [taskId]);
      const previous: Attribution[] = await manager.query(
        'SELECT project_id, tag_id, applied FROM task_auto_tags WHERE task_id = $1', [taskId],
      );
      const desired: Desired[] = await manager.query(`
        SELECT p.id AS project_id, pat.tag_id
        FROM task_tags membership
        JOIN projects p ON p."tagId" = membership.tag_id AND p.deleted_at IS NULL
        JOIN project_auto_tags pat ON pat.project_id = p.id
        WHERE membership.task_id = $1
      `, [taskId]);
      const existing: { tag_id: string }[] = await manager.query(
        'SELECT tag_id FROM task_tags WHERE task_id = $1', [taskId],
      );
      const present = new Set(existing.map((row) => row.tag_id));
      const manual = new Set(manualTagIds);
      const desiredByTag = new Map<string, string[]>();
      for (const row of desired) {
        const projects = desiredByTag.get(row.tag_id) ?? [];
        projects.push(row.project_id);
        desiredByTag.set(row.tag_id, projects);
      }
      const previouslyOwned = new Set(previous.filter((row) => row.applied).map((row) => row.tag_id));
      const oldTags = new Set(previous.map((row) => row.tag_id));

      // Rebuild provenance, transferring ownership between overlapping projects.
      await manager.query('DELETE FROM task_auto_tags WHERE task_id = $1', [taskId]);
      for (const tagId of oldTags) {
        if (!desiredByTag.has(tagId) && previouslyOwned.has(tagId) && !manual.has(tagId)) {
          await manager.query('DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2', [taskId, tagId]);
          present.delete(tagId);
        }
      }
      for (const [tagId, projectIds] of desiredByTag) {
        const owned = !manual.has(tagId) && (previouslyOwned.has(tagId) || !present.has(tagId));
        if (!present.has(tagId)) {
          await manager.query('INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [taskId, tagId]);
        }
        for (const [index, projectId] of projectIds.entries()) {
          await manager.query(
            'INSERT INTO task_auto_tags (task_id, project_id, tag_id, applied) VALUES ($1, $2, $3, $4)',
            [taskId, projectId, tagId, owned && index === 0],
          );
        }
      }
    });
  }

  async forgetManualRemoval(taskId: string, tagId: string): Promise<void> {
    await this.dataSource.query('DELETE FROM task_auto_tags WHERE task_id = $1 AND tag_id = $2', [taskId, tagId]);
  }
}
