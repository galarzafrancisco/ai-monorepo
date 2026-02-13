import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add task blueprints and scheduled tasks tables.
 *
 * Task blueprints are templates for creating tasks, and scheduled tasks
 * define when and how often to create tasks from blueprints.
 */
export class AddTaskBlueprintsAndScheduledTasks1739500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create task_blueprints table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_blueprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        assignee_actor_id TEXT,
        created_by_actor_id TEXT NOT NULL,
        depends_on_ids TEXT,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (assignee_actor_id) REFERENCES actors(id),
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    // Create task_blueprint_tags join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_blueprint_tags (
        task_blueprint_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (task_blueprint_id, tag_id),
        FOREIGN KEY (task_blueprint_id) REFERENCES task_blueprints(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Create scheduled_tasks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        task_blueprint_id TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at DATETIME,
        next_run_at DATETIME NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (task_blueprint_id) REFERENCES task_blueprints(id) ON DELETE CASCADE
      )
    `);

    // Create index for scheduled tasks queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled_next_run
        ON scheduled_tasks(enabled, next_run_at)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_scheduled_tasks_enabled_next_run`);
    await queryRunner.query(`DROP TABLE IF EXISTS scheduled_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS task_blueprint_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS task_blueprints`);
  }
}
