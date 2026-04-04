import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddErrorMessageToTaskExecutionHistoryV21741900000000
  implements MigrationInterface
{
  name = 'AddErrorMessageToTaskExecutionHistoryV21741900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      ADD COLUMN error_message text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      DROP COLUMN error_message
    `);
  }
}
