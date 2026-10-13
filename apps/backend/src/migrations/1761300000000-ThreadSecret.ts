import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each thread gets a secret key that marks the context Taico adds to the
 * agent's conversation. It is filled in the first time the agent runs.
 */
export class ThreadSecret1761300000000 implements MigrationInterface {
  name = 'ThreadSecret1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "threads" ADD "secret" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN "secret"`);
  }
}
