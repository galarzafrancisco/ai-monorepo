import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExecutionTraces1762500000000 implements MigrationInterface {
  name = 'ExecutionTraces1762500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "execution_traces" (
        "execution_id" uuid NOT NULL,
        "sequence" integer NOT NULL CHECK ("sequence" > 0),
        "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
        "harness" text NOT NULL,
        "runner_session_id" text NULL,
        "emitted_at" timestamptz NOT NULL,
        "payload" jsonb NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("execution_id", "sequence")
      )`);
    await queryRunner.query(
      'CREATE INDEX "idx_execution_traces_task_id" ON "execution_traces" ("task_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "execution_traces"');
  }
}
