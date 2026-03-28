import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskExecutionIdToAgentRuns1741600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agent_runs
      ADD COLUMN task_execution_id text
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_task_execution_id
      ON agent_runs (task_execution_id)
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      CREATE TABLE agent_runs_new (
        id varchar PRIMARY KEY NOT NULL,
        actor_id text NOT NULL,
        parent_task_id text NOT NULL,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        started_at datetime,
        ended_at datetime,
        last_ping datetime,
        task_execution_id text,
        CONSTRAINT fk_agent_runs_actor_id FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
        CONSTRAINT fk_agent_runs_parent_task_id FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_agent_runs_task_execution_id FOREIGN KEY (task_execution_id) REFERENCES task_executions(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO agent_runs_new (id, actor_id, parent_task_id, created_at, started_at, ended_at, last_ping, task_execution_id)
      SELECT id, actor_id, parent_task_id, created_at, started_at, ended_at, last_ping, task_execution_id
      FROM agent_runs
    `);

    await queryRunner.query(`DROP TABLE agent_runs`);
    await queryRunner.query(`ALTER TABLE agent_runs_new RENAME TO agent_runs`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_task_execution_id
      ON agent_runs (task_execution_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the column and index
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_agent_runs_task_execution_id',
    );

    // Recreate table without the column (SQLite doesn't support DROP COLUMN directly)
    await queryRunner.query(`
      CREATE TABLE agent_runs_new (
        id varchar PRIMARY KEY NOT NULL,
        actor_id text NOT NULL,
        parent_task_id text NOT NULL,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        started_at datetime,
        ended_at datetime,
        last_ping datetime,
        CONSTRAINT fk_agent_runs_actor_id FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
        CONSTRAINT fk_agent_runs_parent_task_id FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO agent_runs_new (id, actor_id, parent_task_id, created_at, started_at, ended_at, last_ping)
      SELECT id, actor_id, parent_task_id, created_at, started_at, ended_at, last_ping
      FROM agent_runs
    `);

    await queryRunner.query(`DROP TABLE agent_runs`);
    await queryRunner.query(`ALTER TABLE agent_runs_new RENAME TO agent_runs`);
  }
}
