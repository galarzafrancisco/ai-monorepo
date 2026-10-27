import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExecutionTraceSource1762500000002 implements MigrationInterface {
  name = 'ExecutionTraceSource1762500000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE execution_traces
      ADD COLUMN source text NOT NULL DEFAULT 'harness',
      ALTER COLUMN harness DROP NOT NULL`);
    // Upgrade lifecycle records written by the earlier, unmerged UI preview.
    await queryRunner.query(
      `UPDATE execution_traces SET source = 'worker', harness = NULL WHERE harness = 'worker'`,
    );
    await queryRunner.query(`ALTER TABLE execution_traces ADD CONSTRAINT execution_traces_source_check CHECK (
      (source = 'worker' AND harness IS NULL) OR (source = 'harness' AND harness IS NOT NULL)
    )`);
    await queryRunner.query(
      `CREATE INDEX execution_traces_worker_steps_idx ON execution_traces (execution_id, sequence) WHERE source = 'worker'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX execution_traces_worker_steps_idx');
    await queryRunner.query(
      'ALTER TABLE execution_traces DROP CONSTRAINT execution_traces_source_check',
    );
    await queryRunner.query(
      `UPDATE execution_traces SET harness = 'worker' WHERE source = 'worker'`,
    );
    await queryRunner.query(
      'ALTER TABLE execution_traces ALTER COLUMN harness SET NOT NULL, DROP COLUMN source',
    );
  }
}
