import { MigrationInterface, QueryRunner } from 'typeorm';

type DuplicateParentRow = {
  parent_task_id: string;
};

type ThreadIdRow = {
  id: string;
};

export class EnforceSingleThreadPerParentTask1741400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicateParents = (await queryRunner.query(`
      SELECT parent_task_id
      FROM threads
      WHERE parent_task_id IS NOT NULL
        AND deleted_at IS NULL
      GROUP BY parent_task_id
      HAVING COUNT(*) > 1
    `)) as DuplicateParentRow[];

    for (const row of duplicateParents) {
      const threadRows = (await queryRunner.query(
        `
          SELECT id
          FROM threads
          WHERE parent_task_id = ?
            AND deleted_at IS NULL
          ORDER BY created_at ASC, id ASC
        `,
        [row.parent_task_id],
      )) as ThreadIdRow[];

      if (threadRows.length < 2) {
        continue;
      }

      const [primaryThread, ...duplicateThreads] = threadRows;
      for (const duplicateThread of duplicateThreads) {
        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_tasks (thread_id, task_id)
            SELECT ?, task_id
            FROM thread_tasks
            WHERE thread_id = ?
          `,
          [primaryThread.id, duplicateThread.id],
        );

        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_context_blocks (thread_id, context_block_id)
            SELECT ?, context_block_id
            FROM thread_context_blocks
            WHERE thread_id = ?
          `,
          [primaryThread.id, duplicateThread.id],
        );

        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_tags (thread_id, tag_id)
            SELECT ?, tag_id
            FROM thread_tags
            WHERE thread_id = ?
          `,
          [primaryThread.id, duplicateThread.id],
        );

        await queryRunner.query(
          `
            INSERT OR IGNORE INTO thread_participants (thread_id, actor_id)
            SELECT ?, actor_id
            FROM thread_participants
            WHERE thread_id = ?
          `,
          [primaryThread.id, duplicateThread.id],
        );

        await queryRunner.query(
          `
            UPDATE thread_messages
            SET thread_id = ?
            WHERE thread_id = ?
          `,
          [primaryThread.id, duplicateThread.id],
        );

        await queryRunner.query(
          `
            UPDATE threads
            SET deleted_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
          `,
          [duplicateThread.id],
        );
      }
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_threads_parent_task_id_non_null
      ON threads(parent_task_id)
      WHERE parent_task_id IS NOT NULL
        AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_threads_parent_task_id_non_null',
    );
  }
}
