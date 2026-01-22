import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskAssigneeHistory1737578000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create task_assignee_history table
    await queryRunner.query(`
      CREATE TABLE task_assignee_history (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        assignee_actor_id TEXT NOT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_actor_id) REFERENCES actors(id) ON DELETE CASCADE
      )
    `);

    // Create index on task_id for query performance
    await queryRunner.query(`
      CREATE INDEX idx_task_assignee_history_task_id ON task_assignee_history(task_id)
    `);

    // Create index on assigned_at for ordering
    await queryRunner.query(`
      CREATE INDEX idx_task_assignee_history_assigned_at ON task_assignee_history(assigned_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the task_assignee_history table
    await queryRunner.query(`DROP TABLE task_assignee_history`);
  }
}
