import { MigrationInterface, QueryRunner } from 'typeorm';

/** json preserves escaped NULs and unpaired surrogates from raw SDK events. */
export class ExecutionTraceJson1762500000001 implements MigrationInterface {
  name = 'ExecutionTraceJson1762500000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE execution_traces ALTER COLUMN payload TYPE json USING payload::json',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // This deliberately fails rather than silently alter payloads that jsonb rejects.
    await queryRunner.query(
      'ALTER TABLE execution_traces ALTER COLUMN payload TYPE jsonb USING payload::jsonb',
    );
  }
}
