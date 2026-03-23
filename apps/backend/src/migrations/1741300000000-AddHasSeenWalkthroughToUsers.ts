import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHasSeenWalkthroughToUsers1741300000000
  implements MigrationInterface
{
  name = 'AddHasSeenWalkthroughToUsers1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN has_seen_walkthrough BOOLEAN NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite compatibility: recreate table to drop column.
    await queryRunner.query(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        actor_id TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        role TEXT NOT NULL DEFAULT 'standard',
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO users_new (
        id, email, password_hash, actor_id, is_active, role,
        row_version, created_at, updated_at, deleted_at
      )
      SELECT
        id, email, password_hash, actor_id, is_active, role,
        row_version, created_at, updated_at, deleted_at
      FROM users
    `);

    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`ALTER TABLE users_new RENAME TO users`);
  }
}
