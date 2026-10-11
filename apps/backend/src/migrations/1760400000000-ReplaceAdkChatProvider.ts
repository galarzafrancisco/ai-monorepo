import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The "adk" chat provider type is gone. Existing rows become Vertex AI
 * providers, which read project, location and credentials from the
 * environment when nothing is stored.
 */
export class ReplaceAdkChatProvider1760400000000 implements MigrationInterface {
  name = 'ReplaceAdkChatProvider1760400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "chat_providers"
          SET "type" = 'google_vertex',
              "name" = CASE WHEN "name" = 'Google ADK' THEN 'Google Vertex AI' ELSE "name" END
        WHERE "type" = 'adk'`,
    );
  }

  public async down(): Promise<void> {
    // Not reversible: converted rows cannot be told apart from other Vertex AI providers.
  }
}
