import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionsV2Tables1741700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_execution_queue (
        task_id text PRIMARY KEY NOT NULL,
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        deleted_at datetime,
        CONSTRAINT fk_task_execution_queue_task_id
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS active_task_executions_v2 (
        id varchar PRIMARY KEY NOT NULL,
        task_id text NOT NULL UNIQUE,
        claimed_at datetime NOT NULL,
        task_status_before_claim text NOT NULL
          CHECK (task_status_before_claim IN ('NOT_STARTED', 'IN_PROGRESS', 'FOR_REVIEW', 'DONE')),
        task_tags_before_claim text NOT NULL,
        task_assignee_actor_id_before_claim text,
        agent_actor_id text NOT NULL,
        worker_client_id text NOT NULL,
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        deleted_at datetime,
        CONSTRAINT fk_active_task_executions_v2_task_id
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_active_task_executions_v2_agent_actor_id
          FOREIGN KEY (agent_actor_id) REFERENCES agents(actor_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_active_task_executions_v2_agent_actor_id
      ON active_task_executions_v2 (agent_actor_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_active_task_executions_v2_worker_client_id
      ON active_task_executions_v2 (worker_client_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_active_task_executions_v2_claimed_at
      ON active_task_executions_v2 (claimed_at)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_execution_history_v2 (
        id varchar PRIMARY KEY NOT NULL,
        task_id text NOT NULL,
        claimed_at datetime NOT NULL,
        transitioned_at datetime NOT NULL,
        agent_actor_id text NOT NULL,
        worker_client_id text NOT NULL,
        status text NOT NULL
          CHECK (status IN ('SUCCEEDED', 'FAILED', 'STALE', 'CANCELLED')),
        error_code text
          CHECK (error_code IS NULL OR error_code IN ('OUT_OF_QUOTA', 'UNKNOWN')),
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        deleted_at datetime,
        CONSTRAINT fk_task_execution_history_v2_task_id
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_execution_history_v2_agent_actor_id
          FOREIGN KEY (agent_actor_id) REFERENCES agents(actor_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_task_id
      ON task_execution_history_v2 (task_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_agent_actor_id
      ON task_execution_history_v2 (agent_actor_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_worker_client_id
      ON task_execution_history_v2 (worker_client_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_transitioned_at
      ON task_execution_history_v2 (transitioned_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_task_execution_history_v2_transitioned_at',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_task_execution_history_v2_worker_client_id',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_task_execution_history_v2_agent_actor_id',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_task_execution_history_v2_task_id',
    );
    await queryRunner.query('DROP TABLE IF EXISTS task_execution_history_v2');

    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_active_task_executions_v2_claimed_at',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_active_task_executions_v2_agent_actor_id',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_active_task_executions_v2_worker_client_id',
    );
    await queryRunner.query('DROP TABLE IF EXISTS active_task_executions_v2');

    await queryRunner.query('DROP TABLE IF EXISTS task_execution_queue');
  }
}
