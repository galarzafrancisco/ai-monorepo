import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameExecutionTables1742200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      RENAME TO active_task_executions
    `);

    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      RENAME TO task_execution_history
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE task_execution_history
      RENAME TO task_execution_history_v2
    `);

    await queryRunner.query(`
      ALTER TABLE active_task_executions
      RENAME TO active_task_executions_v2
    `);
  }
}
