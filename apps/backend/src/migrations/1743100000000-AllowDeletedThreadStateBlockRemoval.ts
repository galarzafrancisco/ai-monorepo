import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowDeletedThreadStateBlockRemoval1743100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.recreateThreadsTable(queryRunner, 'SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.recreateThreadsTable(queryRunner, 'RESTRICT');
  }

  private async recreateThreadsTable(
    queryRunner: QueryRunner,
    onDelete: 'RESTRICT' | 'SET NULL',
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE threads_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        chat_session_id TEXT,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT,
        state_context_block_id TEXT,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
        FOREIGN KEY (state_context_block_id) REFERENCES context_blocks(id) ON DELETE ${onDelete}
      )
    `);
    await queryRunner.query(`
      INSERT INTO threads_new (
        id, title, chat_session_id, created_by_actor_id, parent_task_id,
        state_context_block_id, row_version, created_at, updated_at, deleted_at
      )
      SELECT
        id, title, chat_session_id, created_by_actor_id, parent_task_id,
        state_context_block_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);
    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_parent_task_id
      ON threads(parent_task_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_state_context_block_id
      ON threads(state_context_block_id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_threads_parent_task_id_non_null
      ON threads(parent_task_id)
      WHERE parent_task_id IS NOT NULL
        AND deleted_at IS NULL
    `);
  }
}
