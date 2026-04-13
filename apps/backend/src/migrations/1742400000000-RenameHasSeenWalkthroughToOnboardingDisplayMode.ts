import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameHasSeenWalkthroughToOnboardingDisplayMode1742400000000
  implements MigrationInterface
{
  name = 'RenameHasSeenWalkthroughToOnboardingDisplayMode1742400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        actor_id TEXT NOT NULL UNIQUE,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        role TEXT NOT NULL DEFAULT 'standard',
        onboarding_display_mode TEXT NOT NULL DEFAULT 'FULL_PAGE',
        rowVersion INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO users_new (
        id, email, passwordHash, actor_id, isActive, role,
        onboarding_display_mode,
        rowVersion, createdAt, updatedAt, deletedAt
      )
      SELECT
        id, email, passwordHash, actor_id, isActive, role,
        CASE
          WHEN has_seen_walkthrough = 1 THEN 'OFF'
          ELSE 'FULL_PAGE'
        END,
        rowVersion, createdAt, updatedAt, deletedAt
      FROM users
    `);

    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`ALTER TABLE users_new RENAME TO users`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        actor_id TEXT NOT NULL UNIQUE,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        role TEXT NOT NULL DEFAULT 'standard',
        has_seen_walkthrough BOOLEAN NOT NULL DEFAULT 0,
        rowVersion INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO users_new (
        id, email, passwordHash, actor_id, isActive, role,
        has_seen_walkthrough,
        rowVersion, createdAt, updatedAt, deletedAt
      )
      SELECT
        id, email, passwordHash, actor_id, isActive, role,
        CASE
          WHEN onboarding_display_mode = 'OFF' THEN 1
          ELSE 0
        END,
        rowVersion, createdAt, updatedAt, deletedAt
      FROM users
    `);

    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`ALTER TABLE users_new RENAME TO users`);
  }
}
