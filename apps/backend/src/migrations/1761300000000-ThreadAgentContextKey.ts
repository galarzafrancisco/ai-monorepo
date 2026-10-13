import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each thread gets a secret key that marks the context Taico adds to the
 * agent's conversation. It is filled in the first time the agent runs.
 */
export class ThreadAgentContextKey1761300000000 implements MigrationInterface {
  name = 'ThreadAgentContextKey1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "threads" ADD "agent_context_key" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN "agent_context_key"`);
  }
}
