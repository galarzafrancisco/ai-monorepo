import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentTaskIdToThread1770613987 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE threads ADD COLUMN parent_task_id TEXT`,
    );

    await queryRunner.query(`
      DELETE FROM thread_context_blocks
      WHERE thread_id IN (
        SELECT id FROM threads
        WHERE id NOT IN (SELECT DISTINCT thread_id FROM thread_tasks)
      )
    `);

    await queryRunner.query(`
      DELETE FROM thread_tags
      WHERE thread_id IN (
        SELECT id FROM threads
        WHERE id NOT IN (SELECT DISTINCT thread_id FROM thread_tasks)
      )
    `);

    await queryRunner.query(`
      DELETE FROM thread_participants
      WHERE thread_id IN (
        SELECT id FROM threads
        WHERE id NOT IN (SELECT DISTINCT thread_id FROM thread_tasks)
      )
    `);

    await queryRunner.query(`
      DELETE FROM threads
      WHERE id NOT IN (SELECT DISTINCT thread_id FROM thread_tasks)
    `);

    await queryRunner.query(`
      UPDATE threads
      SET parent_task_id = COALESCE(
        (
          SELECT ar.parent_task_id
          FROM agent_runs ar
          WHERE ar.parent_task_id IN (
            SELECT tt.task_id FROM thread_tasks tt WHERE tt.thread_id = threads.id
          )
          ORDER BY ar.created_at ASC
          LIMIT 1
        ),
        (
          SELECT tt.task_id
          FROM thread_tasks tt
          WHERE tt.thread_id = threads.id
          ORDER BY tt.rowid ASC
          LIMIT 1
        )
      )
      WHERE parent_task_id IS NULL
    `);

    await queryRunner.query('PRAGMA foreign_keys=OFF');

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
        FOREIGN KEY(created_by_actor_id) REFERENCES actors(id) ON DELETE RESTRICT,
        FOREIGN KEY(parent_task_id) REFERENCES tasks(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      INSERT INTO threads_new (
        id,
        title,
        created_by_actor_id,
        parent_task_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        title,
        created_by_actor_id,
        parent_task_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      FROM threads
    `);

    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    await queryRunner.query(
      `CREATE INDEX idx_threads_parent_task_id ON threads(parent_task_id)`,
    );

    await queryRunner.query('PRAGMA foreign_keys=ON');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys=OFF');

    await queryRunner.query(`
      CREATE TABLE threads_old (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME,
        FOREIGN KEY(created_by_actor_id) REFERENCES actors(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      INSERT INTO threads_old (
        id,
        title,
        created_by_actor_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        title,
        created_by_actor_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      FROM threads
    `);

    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_old RENAME TO threads`);
    await queryRunner.query('PRAGMA foreign_keys=ON');
  }
}
