import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionPersistenceTables1741500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS worker_sessions (
        id varchar PRIMARY KEY NOT NULL,
        oauth_client_id text NOT NULL,
        status text NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'DRAINING', 'STALE')),
        connected_at datetime NOT NULL DEFAULT (datetime('now')),
        last_heartbeat_at datetime,
        hostname text,
        pid integer,
        version text,
        capabilities text,
        last_seen_ip text,
        draining_at datetime,
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_worker_sessions_status_last_heartbeat_at
      ON worker_sessions (status, last_heartbeat_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_worker_sessions_oauth_client_id
      ON worker_sessions (oauth_client_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_executions (
        id varchar PRIMARY KEY NOT NULL,
        task_id text NOT NULL,
        agent_actor_id text NOT NULL,
        status text NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'CLAIMED', 'RUNNING', 'STOP_REQUESTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'STALE')),
        requested_at datetime NOT NULL DEFAULT (datetime('now')),
        claimed_at datetime,
        started_at datetime,
        finished_at datetime,
        worker_session_id text,
        lease_expires_at datetime,
        stop_requested_at datetime,
        failure_reason text,
        trigger_reason text,
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT fk_task_executions_task_id FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_executions_agent_actor_id FOREIGN KEY (agent_actor_id) REFERENCES actors(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_executions_worker_session_id FOREIGN KEY (worker_session_id) REFERENCES worker_sessions(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_executions_task_id
      ON task_executions (task_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_executions_agent_actor_id
      ON task_executions (agent_actor_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_executions_worker_session_id
      ON task_executions (worker_session_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_executions_status_requested_at
      ON task_executions (status, requested_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_task_executions_status_requested_at',
    );
    await queryRunner.query('DROP INDEX IF EXISTS idx_task_executions_worker_session_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_task_executions_agent_actor_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_task_executions_task_id');
    await queryRunner.query('DROP TABLE IF EXISTS task_executions');

    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_worker_sessions_oauth_client_id',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_worker_sessions_status_last_heartbeat_at',
    );
    await queryRunner.query('DROP TABLE IF EXISTS worker_sessions');
  }
}
