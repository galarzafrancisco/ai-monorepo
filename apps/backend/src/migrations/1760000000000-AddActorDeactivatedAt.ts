import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActorDeactivatedAt1760000000000 implements MigrationInterface {
  name = 'AddActorDeactivatedAt1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "actors" ADD "deactivated_at" TIMESTAMP WITH TIME ZONE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "actors" DROP COLUMN "deactivated_at"',
    );
  }
}
