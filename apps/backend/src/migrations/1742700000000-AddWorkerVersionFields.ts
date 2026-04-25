import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkerVersionFields1742700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workers
      ADD COLUMN worker_version text
    `);

    await queryRunner.query(`
      ALTER TABLE execution_stats
      ADD COLUMN worker_version text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE execution_stats
      DROP COLUMN worker_version
    `);

    await queryRunner.query(`
      ALTER TABLE workers
      DROP COLUMN worker_version
    `);
  }
}
