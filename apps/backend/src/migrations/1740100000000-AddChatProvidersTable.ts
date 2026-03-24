import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the chat_providers table for storing chat provider configurations.
 *
 * This table stores provider configurations like OpenAI, with links to
 * secrets for API keys. Only one provider can be active at a time.
 */
export class AddChatProvidersTable1740100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        secret_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 0,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (secret_id) REFERENCES secrets(id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_providers_is_active
        ON chat_providers(is_active)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_providers_is_active`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_providers`);
  }
}
