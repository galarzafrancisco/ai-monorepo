import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatProviderModelConfig1760300000000 implements MigrationInterface {
  name = 'ChatProviderModelConfig1760300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_providers" ADD "model_id" text, ADD "base_url" text, ADD "project" text, ADD "location" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_providers" DROP COLUMN "location", DROP COLUMN "project", DROP COLUMN "base_url", DROP COLUMN "model_id"`,
    );
  }
}
