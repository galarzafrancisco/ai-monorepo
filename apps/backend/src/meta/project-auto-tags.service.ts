import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

type Attribution = { project_id: string; tag_id: string; applied: boolean };
type Desired = { project_id: string; tag_id: string };

/** Keeps task tags and their project provenance in step when project membership changes. */
@Injectable()
export class ProjectAutoTagsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Serialize membership changes and provenance on the same task row. */
  async withLockedTask<T>(
    taskId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [
        taskId,
      ]);
      return work(manager);
    });
  }

  async syncTask(
    taskId: string,
    newProjectTagIds: string[] = [],
    manualTagIds: string[] = [],
    transactionManager?: EntityManager,
  ): Promise<void> {
    const sync = async (manager: EntityManager) => {
      await manager.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [
        taskId,
      ]);
      const previous: Attribution[] = await manager.query(
        'SELECT project_id, tag_id, applied FROM task_auto_tags WHERE task_id = $1',
        [taskId],
      );
      const memberships: { project_id: string }[] = await manager.query(
        `
        SELECT p.id AS project_id
        FROM task_tags membership
        JOIN projects p ON p."tagId" = membership.tag_id AND p.deleted_at IS NULL
        WHERE membership.task_id = $1
      `,
        [taskId],
      );
      const activeProjects = new Set(memberships.map((row) => row.project_id));
      // Existing memberships retain their original configuration, including an empty one.
      const desired: Desired[] = previous.filter((row) =>
        activeProjects.has(row.project_id),
      );
      if (newProjectTagIds.length > 0) {
        const added: Desired[] = await manager.query(
          `
          SELECT p.id AS project_id, pat.tag_id
          FROM projects p
          JOIN task_tags membership ON membership.tag_id = p."tagId" AND membership.task_id = $1
          JOIN project_auto_tags pat ON pat.project_id = p.id
          WHERE p."tagId" = ANY($2::uuid[]) AND p.deleted_at IS NULL
        `,
          [taskId, newProjectTagIds],
        );
        desired.push(...added);
      }
      const existing: { tag_id: string }[] = await manager.query(
        'SELECT tag_id FROM task_tags WHERE task_id = $1',
        [taskId],
      );
      const present = new Set(existing.map((row) => row.tag_id));
      const manual = new Set(manualTagIds);
      const desiredByTag = new Map<string, Set<string>>();
      for (const row of desired) {
        const projects = desiredByTag.get(row.tag_id) ?? new Set<string>();
        projects.add(row.project_id);
        desiredByTag.set(row.tag_id, projects);
      }
      const previouslyOwned = new Set(
        previous.filter((row) => row.applied).map((row) => row.tag_id),
      );
      const oldTags = new Set(previous.map((row) => row.tag_id));

      // Rebuild provenance, transferring ownership between overlapping projects.
      await manager.query('DELETE FROM task_auto_tags WHERE task_id = $1', [
        taskId,
      ]);
      for (const tagId of oldTags) {
        if (
          !desiredByTag.has(tagId) &&
          previouslyOwned.has(tagId) &&
          !manual.has(tagId)
        ) {
          await manager.query(
            'DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2',
            [taskId, tagId],
          );
          present.delete(tagId);
        }
      }
      for (const [tagId, projectIds] of desiredByTag) {
        const owned =
          !manual.has(tagId) &&
          (previouslyOwned.has(tagId) || !present.has(tagId));
        if (!present.has(tagId)) {
          await manager.query(
            'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)',
            [taskId, tagId],
          );
        }
        for (const [index, projectId] of [...projectIds].entries()) {
          await manager.query(
            'INSERT INTO task_auto_tags (task_id, project_id, tag_id, applied) VALUES ($1, $2, $3, $4)',
            [taskId, projectId, tagId, owned && index === 0],
          );
        }
      }
    };
    if (transactionManager) await sync(transactionManager);
    else await this.dataSource.transaction(sync);
  }

  async forgetManualRemoval(
    taskId: string,
    tagId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await (manager ?? this.dataSource).query(
      'DELETE FROM task_auto_tags WHERE task_id = $1 AND tag_id = $2',
      [taskId, tagId],
    );
  }
}
