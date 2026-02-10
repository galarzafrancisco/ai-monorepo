import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentTaskIdToThreads1739232000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Since we're doing a hard cleanup of existing threads,
    // we can simply recreate the table with the new column

    // Create new threads table with parent_task_id column
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

    // Drop old threads table (and all related data)
    // This will cascade delete from junction tables
    await queryRunner.query(`DROP TABLE IF EXISTS threads`);

    // Rename new table
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    // Create indices for performance
    await queryRunner.query(`
      CREATE INDEX idx_threads_created_by_actor ON threads(created_by_actor_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_threads_parent_task ON threads(parent_task_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate original table structure without parent_task_id
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

    // Drop new table (data loss is acceptable since this is a migration rollback)
    await queryRunner.query(`DROP TABLE threads`);

    // Rename old table back
    await queryRunner.query(`ALTER TABLE threads_old RENAME TO threads`);

    // Recreate index
    await queryRunner.query(`
      CREATE INDEX idx_threads_created_by_actor ON threads(created_by_actor_id)
    `);
  }
}
