import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueIndexThreadsParentTask2026021100001
  implements MigrationInterface
{
  name = 'AddUniqueIndexThreadsParentTask2026021100001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates: Array<{ parentTaskId?: string; parent_task_id?: string }> =
      await queryRunner.query(`
        SELECT parent_task_id as parentTaskId
        FROM threads
        GROUP BY parent_task_id
        HAVING COUNT(*) > 1
      `);

    for (const duplicate of duplicates) {
      const parentTaskId = duplicate.parentTaskId ?? duplicate.parent_task_id;
      if (!parentTaskId) {
        continue;
      }

      const threadRows: Array<{ id: string }> = await queryRunner.query(
        `
          SELECT id
          FROM threads
          WHERE parent_task_id = ?
          ORDER BY created_at ASC
        `,
        [parentTaskId],
      );

      const [canonicalThread] = threadRows;
      if (!canonicalThread) {
        continue;
      }

      const duplicateIds = threadRows.slice(1).map((row) => row.id);

      for (const duplicateId of duplicateIds) {
        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_tasks (thread_id, task_id)
            SELECT ?, task_id FROM thread_tasks WHERE thread_id = ?
          `,
          [canonicalThread.id, duplicateId],
        );
        await queryRunner.query(
          `DELETE FROM thread_tasks WHERE thread_id = ?`,
          [duplicateId],
        );

        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_context_blocks (thread_id, context_block_id)
            SELECT ?, context_block_id FROM thread_context_blocks WHERE thread_id = ?
          `,
          [canonicalThread.id, duplicateId],
        );
        await queryRunner.query(
          `DELETE FROM thread_context_blocks WHERE thread_id = ?`,
          [duplicateId],
        );

        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_tags (thread_id, tag_id)
            SELECT ?, tag_id FROM thread_tags WHERE thread_id = ?
          `,
          [canonicalThread.id, duplicateId],
        );
        await queryRunner.query(`DELETE FROM thread_tags WHERE thread_id = ?`, [
          duplicateId,
        ]);

        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_participants (thread_id, actor_id)
            SELECT ?, actor_id FROM thread_participants WHERE thread_id = ?
          `,
          [canonicalThread.id, duplicateId],
        );
        await queryRunner.query(
          `DELETE FROM thread_participants WHERE thread_id = ?`,
          [duplicateId],
        );

        await queryRunner.query(`DELETE FROM threads WHERE id = ?`, [duplicateId]);
      }
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_parent_task_id_unique ON threads(parent_task_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_threads_parent_task_id_unique`,
    );
  }
}
