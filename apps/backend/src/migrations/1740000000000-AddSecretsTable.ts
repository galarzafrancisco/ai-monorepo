import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the secrets table with a partial unique index on name (WHERE deleted_at IS NULL).
 *
 * Using a partial index rather than a column-level UNIQUE constraint allows
 * soft-deleted secret names to be reused.
 */
export class AddSecretsTable1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS secrets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        encrypted_value TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_name
        ON secrets(name)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_secrets_name`);
    await queryRunner.query(`DROP TABLE IF EXISTS secrets`);
  }
}
