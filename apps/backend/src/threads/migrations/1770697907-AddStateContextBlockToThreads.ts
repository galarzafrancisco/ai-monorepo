import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStateContextBlockToThreads1770697907
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Since the task description says to ignore migration of existing data
    // and do a force clean of all existing threads, we'll:
    // 1. Delete all existing threads
    // 2. Recreate the threads table with the new schema

    // Drop existing thread-related join tables first
    await queryRunner.query(`DROP TABLE IF EXISTS thread_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_context_blocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_participants`);

    // Drop the threads table
    await queryRunner.query(`DROP TABLE IF EXISTS threads`);

    // Recreate threads table with state_context_block_id
    await queryRunner.query(`
      CREATE TABLE threads (
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

    // Recreate join tables
    await queryRunner.query(`
      CREATE TABLE thread_tasks (
        thread_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, task_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE thread_context_blocks (
        thread_id TEXT NOT NULL,
        context_block_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, context_block_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (context_block_id) REFERENCES context_blocks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE thread_tags (
        thread_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, tag_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE thread_participants (
        thread_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, actor_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX idx_threads_parent_task_id ON threads(parent_task_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_threads_state_context_block_id ON threads(state_context_block_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop join tables
    await queryRunner.query(`DROP TABLE IF EXISTS thread_participants`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_context_blocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_tasks`);

    // Drop threads table
    await queryRunner.query(`DROP TABLE IF EXISTS threads`);

    // Recreate old threads table without state_context_block_id
    await queryRunner.query(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      )
    `);

    // Recreate join tables
    await queryRunner.query(`
      CREATE TABLE thread_tasks (
        thread_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, task_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE thread_context_blocks (
        thread_id TEXT NOT NULL,
        context_block_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, context_block_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (context_block_id) REFERENCES context_blocks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE thread_tags (
        thread_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, tag_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE thread_participants (
        thread_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, actor_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_threads_parent_task_id ON threads(parent_task_id)
    `);
  }
}
