import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastHeartbeatAtToActiveExecutionsV21741800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      ADD COLUMN last_heartbeat_at datetime
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      DROP COLUMN last_heartbeat_at
    `);
  }
}
