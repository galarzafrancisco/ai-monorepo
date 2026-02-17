import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorThreadsForHeadlessConversations1739750000000
  implements MigrationInterface
{
  name = 'RefactorThreadsForHeadlessConversations1739750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create the thread_messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS thread_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by_actor_id TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id
        ON thread_messages(thread_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at
        ON thread_messages(created_at)
    `);

    // Step 2: Make parent_task_id nullable in threads table
    // SQLite doesn't support ALTER COLUMN, so we need to recreate the table

    // Create new threads table with nullable parent_task_id
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

    // Copy data from old table to new table
    await queryRunner.query(`
      INSERT INTO threads_new (
        id, title, created_by_actor_id, parent_task_id,
        state_context_block_id, row_version, created_at,
        updated_at, deleted_at
      )
      SELECT
        id, title, created_by_actor_id, parent_task_id,
        state_context_block_id, row_version, created_at,
        updated_at, deleted_at
      FROM threads
    `);

    // Drop old table
    await queryRunner.query(`DROP TABLE threads`);

    // Rename new table to threads
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    // Recreate indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_parent_task_id
        ON threads(parent_task_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_state_context_block_id
        ON threads(state_context_block_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop thread_messages table
    await queryRunner.query(`DROP TABLE IF EXISTS thread_messages`);

    // Revert threads table to make parent_task_id NOT NULL
    // Note: This will fail if there are threads with NULL parent_task_id
    await queryRunner.query(`
      CREATE TABLE threads_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT NOT NULL,
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

    // Copy data (this will fail if there are NULL parent_task_id values)
    await queryRunner.query(`
      INSERT INTO threads_new (
        id, title, created_by_actor_id, parent_task_id,
        state_context_block_id, row_version, created_at,
        updated_at, deleted_at
      )
      SELECT
        id, title, created_by_actor_id, parent_task_id,
        state_context_block_id, row_version, created_at,
        updated_at, deleted_at
      FROM threads
      WHERE parent_task_id IS NOT NULL
    `);

    await queryRunner.query(`DROP TABLE threads`);

    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    // Recreate indexes
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
