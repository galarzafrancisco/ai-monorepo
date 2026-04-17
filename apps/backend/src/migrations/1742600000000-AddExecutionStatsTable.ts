import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionStatsTable1742600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS execution_stats (
        execution_id uuid PRIMARY KEY,
        harness text,
        provider_id text,
        model_id text,
        input_tokens integer,
        output_tokens integer,
        total_tokens integer,
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_execution_stats_harness
      ON execution_stats (harness)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_execution_stats_provider_model
      ON execution_stats (provider_id, model_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_execution_stats_provider_model');
    await queryRunner.query('DROP INDEX IF EXISTS idx_execution_stats_harness');
    await queryRunner.query('DROP TABLE IF EXISTS execution_stats');
  }
}
