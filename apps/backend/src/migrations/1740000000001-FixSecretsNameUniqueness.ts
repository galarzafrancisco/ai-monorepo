import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes the secrets table uniqueness constraint.
 *
 * The initial migration added UNIQUE directly on the `name` column, which
 * prevents reusing a secret name after soft-deletion (deleted_at IS NOT NULL).
 *
 * This migration recreates the table without the column-level UNIQUE constraint,
 * keeping only the partial unique index (WHERE deleted_at IS NULL) so that
 * soft-deleted names can be reused.
 *
 * SQLite does not support ALTER TABLE DROP CONSTRAINT, so we use the
 * standard rename-copy-drop-rename approach.
 */
export class FixSecretsNameUniqueness1740000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Rename existing table
    await queryRunner.query(`ALTER TABLE secrets RENAME TO secrets_old`);

    // Step 2: Drop old index (it references the old table implicitly via name)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_secrets_name`);

    // Step 3: Create new table WITHOUT column-level UNIQUE on name
    await queryRunner.query(`
      CREATE TABLE secrets (
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

    // Step 4: Copy data
    await queryRunner.query(`
      INSERT INTO secrets
        (id, name, description, encrypted_value, created_by_actor_id,
         row_version, created_at, updated_at, deleted_at)
      SELECT
        id, name, description, encrypted_value, created_by_actor_id,
        row_version, created_at, updated_at, deleted_at
      FROM secrets_old
    `);

    // Step 5: Drop old table
    await queryRunner.query(`DROP TABLE secrets_old`);

    // Step 6: Recreate partial unique index on the new table
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_secrets_name
        ON secrets(name)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: recreate with column-level UNIQUE (original schema)
    await queryRunner.query(`ALTER TABLE secrets RENAME TO secrets_new`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_secrets_name`);

    await queryRunner.query(`
      CREATE TABLE secrets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
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
      INSERT INTO secrets
        (id, name, description, encrypted_value, created_by_actor_id,
         row_version, created_at, updated_at, deleted_at)
      SELECT
        id, name, description, encrypted_value, created_by_actor_id,
        row_version, created_at, updated_at, deleted_at
      FROM secrets_new
    `);

    await queryRunner.query(`DROP TABLE secrets_new`);

    await queryRunner.query(`
      CREATE INDEX idx_secrets_name
        ON secrets(name)
        WHERE deleted_at IS NULL
    `);
  }
}
