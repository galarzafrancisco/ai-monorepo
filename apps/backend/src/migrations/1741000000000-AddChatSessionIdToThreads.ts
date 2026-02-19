import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatSessionIdToThreads1741000000000
  implements MigrationInterface
{
  name = 'AddChatSessionIdToThreads1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE threads
      ADD COLUMN chat_session_id TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite compatibility: recreate table to drop column.
    await queryRunner.query(`
      CREATE TABLE threads_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT,
        state_context_block_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
        FOREIGN KEY (state_context_block_id) REFERENCES context_blocks(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      INSERT INTO threads_new (
        id, title, created_by_actor_id, parent_task_id, state_context_block_id,
        row_version, created_at, updated_at, deleted_at
      )
      SELECT
        id, title, created_by_actor_id, parent_task_id, state_context_block_id,
        row_version, created_at, updated_at, deleted_at
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
  }
}
