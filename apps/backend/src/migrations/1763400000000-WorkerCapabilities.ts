import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkerCapabilities1763400000000 implements MigrationInterface {
  name = 'WorkerCapabilities1763400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "workers" ADD "capabilities" text');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "workers" DROP COLUMN "capabilities"');
  }
}
