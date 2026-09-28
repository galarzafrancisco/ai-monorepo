import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActorSoftDelete1760000000000 implements MigrationInterface {
  name = 'AddActorSoftDelete1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "actors" ADD "deleted_at" TIMESTAMP WITH TIME ZONE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "actors" DROP COLUMN "deleted_at"',
    );
  }
}
