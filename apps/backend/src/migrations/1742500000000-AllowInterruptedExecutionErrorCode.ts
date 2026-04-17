import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowInterruptedExecutionErrorCode1742500000000
  implements MigrationInterface
{
  name = 'AllowInterruptedExecutionErrorCode1742500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rebuildTaskExecutionHistory(queryRunner, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE task_execution_history
      SET error_code = 'UNKNOWN'
      WHERE error_code = 'INTERRUPTED'
    `);
    await this.rebuildTaskExecutionHistory(queryRunner, false);
  }

  private async rebuildTaskExecutionHistory(
    queryRunner: QueryRunner,
    allowInterrupted: boolean,
  ): Promise<void> {
    const errorCodes = allowInterrupted
      ? "'OUT_OF_QUOTA', 'INTERRUPTED', 'UNKNOWN'"
      : "'OUT_OF_QUOTA', 'UNKNOWN'";

    await queryRunner.query('PRAGMA foreign_keys=off');
    try {
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

      await queryRunner.query(`
        CREATE TABLE task_execution_history_new (
          id varchar PRIMARY KEY NOT NULL,
          task_id text NOT NULL,
          claimed_at datetime NOT NULL,
          transitioned_at datetime NOT NULL,
          agent_actor_id text NOT NULL,
          worker_client_id text NOT NULL,
          status text NOT NULL
            CHECK (status IN ('SUCCEEDED', 'FAILED', 'STALE', 'CANCELLED')),
          error_code text
            CHECK (error_code IS NULL OR error_code IN (${errorCodes})),
          row_version integer NOT NULL DEFAULT 1,
          created_at datetime NOT NULL DEFAULT (datetime('now')),
          updated_at datetime NOT NULL DEFAULT (datetime('now')),
          deleted_at datetime,
          error_message text,
          runner_session_id text,
          tool_call_count integer NOT NULL DEFAULT 0,
          CONSTRAINT fk_task_execution_history_task_id
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          CONSTRAINT fk_task_execution_history_agent_actor_id
            FOREIGN KEY (agent_actor_id) REFERENCES agents(actor_id)
        )
      `);

      await queryRunner.query(`
        INSERT INTO task_execution_history_new (
          id,
          task_id,
          claimed_at,
          transitioned_at,
          agent_actor_id,
          worker_client_id,
          status,
          error_code,
          row_version,
          created_at,
          updated_at,
          deleted_at,
          error_message,
          runner_session_id,
          tool_call_count
        )
        SELECT
          id,
          task_id,
          claimed_at,
          transitioned_at,
          agent_actor_id,
          worker_client_id,
          status,
          error_code,
          row_version,
          created_at,
          updated_at,
          deleted_at,
          error_message,
          runner_session_id,
          tool_call_count
        FROM task_execution_history
      `);

      await queryRunner.query('DROP TABLE task_execution_history');
      await queryRunner.query(`
        ALTER TABLE task_execution_history_new
        RENAME TO task_execution_history
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_task_id
        ON task_execution_history (task_id)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_agent_actor_id
        ON task_execution_history (agent_actor_id)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_worker_client_id
        ON task_execution_history (worker_client_id)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_task_execution_history_v2_transitioned_at
        ON task_execution_history (transitioned_at)
      `);
    } finally {
      await queryRunner.query('PRAGMA foreign_keys=on');
    }
  }
}
