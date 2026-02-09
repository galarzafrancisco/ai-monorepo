import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentTaskIdToThread1739066000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add parent_task_id column as nullable initially to allow backfill
    await queryRunner.query(`
      ALTER TABLE threads ADD COLUMN parent_task_id TEXT
    `);

    // Backfill parent_task_id using the same logic as the old resolveParentTaskId method
    // For each thread, find the earliest agent run whose parentTaskId is in the thread's tasks
    // If no such run exists, use the first task in the thread
    await queryRunner.query(`
      UPDATE threads
      SET parent_task_id = (
        SELECT COALESCE(
          (
            SELECT ar.parent_task_id
            FROM agent_runs ar
            INNER JOIN thread_tasks tt ON ar.parent_task_id = tt.task_id
            WHERE tt.thread_id = threads.id
            ORDER BY ar.created_at ASC
            LIMIT 1
          ),
          (
            SELECT task_id
            FROM thread_tasks
            WHERE thread_id = threads.id
            LIMIT 1
          )
        )
      )
    `);

    // Make the column NOT NULL after backfill
    await queryRunner.query(`
      CREATE TABLE threads_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE RESTRICT
      )
    `);

    // Copy data to new table
    await queryRunner.query(`
      INSERT INTO threads_new (id, title, created_by_actor_id, parent_task_id, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, created_by_actor_id, parent_task_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);

    // Drop old table
    await queryRunner.query(`DROP TABLE threads`);

    // Rename new table
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    // Recreate indexes
    await queryRunner.query(`
      CREATE INDEX idx_threads_created_by_actor_id ON threads(created_by_actor_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_threads_parent_task_id ON threads(parent_task_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate table without parent_task_id column
    await queryRunner.query(`
      CREATE TABLE threads_old (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    // Copy data back (excluding parent_task_id)
    await queryRunner.query(`
      INSERT INTO threads_old (id, title, created_by_actor_id, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, created_by_actor_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);

    // Drop new table
    await queryRunner.query(`DROP TABLE threads`);

    // Rename old table back
    await queryRunner.query(`ALTER TABLE threads_old RENAME TO threads`);

    // Recreate index
    await queryRunner.query(`
      CREATE INDEX idx_threads_created_by_actor_id ON threads(created_by_actor_id)
    `);
  }
}
