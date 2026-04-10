import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionEnrichmentFieldsV21742100000000
  implements MigrationInterface
{
  name = 'AddExecutionEnrichmentFieldsV21742100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      ADD COLUMN runner_session_id text
    `);
    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      ADD COLUMN tool_call_count integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      ADD COLUMN runner_session_id text
    `);
    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      ADD COLUMN tool_call_count integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      DROP COLUMN tool_call_count
    `);
    await queryRunner.query(`
      ALTER TABLE task_execution_history_v2
      DROP COLUMN runner_session_id
    `);

    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      DROP COLUMN tool_call_count
    `);
    await queryRunner.query(`
      ALTER TABLE active_task_executions_v2
      DROP COLUMN runner_session_id
    `);
  }
}
