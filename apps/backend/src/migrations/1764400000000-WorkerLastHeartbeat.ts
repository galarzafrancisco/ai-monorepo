import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When a worker last sent a worker heartbeat. Set only by heartbeats, so a
 * value proves the worker sends them, and its executions can be released
 * soon after it goes quiet. Workers that never heartbeat keep it null.
 */
export class WorkerLastHeartbeat1764400000000 implements MigrationInterface {
  name = 'WorkerLastHeartbeat1764400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN IF EXISTS "last_heartbeat_at"`);
  }
}
