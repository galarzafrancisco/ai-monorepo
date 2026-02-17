import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAgentTypeConstraint1700000000002
  implements MigrationInterface
{
  name = 'UpdateAgentTypeConstraint1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`PRAGMA foreign_keys=off`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents_new (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'claude' CHECK (
          type IN ('claude', 'codex', 'opencode', 'adk', 'githubcopilot', 'other')
        ),
        description TEXT,
        system_prompt TEXT NOT NULL,
        provider_id TEXT,
        model_id TEXT,
        status_triggers TEXT NOT NULL DEFAULT '',
        tag_triggers TEXT NOT NULL DEFAULT '',
        allowed_tools TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        concurrency_limit INTEGER,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO agents_new (
        id,
        actor_id,
        type,
        description,
        system_prompt,
        provider_id,
        model_id,
        status_triggers,
        tag_triggers,
        allowed_tools,
        is_active,
        concurrency_limit,
        row_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        actor_id,
        type,
        description,
        system_prompt,
        provider_id,
        model_id,
        status_triggers,
        tag_triggers,
        allowed_tools,
        is_active,
        concurrency_limit,
        row_version,
        created_at,
        updated_at,
        deleted_at
      FROM agents
    `);
    await queryRunner.query(`DROP TABLE agents`);
    await queryRunner.query(`ALTER TABLE agents_new RENAME TO agents`);
    await queryRunner.query(`PRAGMA foreign_keys=on`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`PRAGMA foreign_keys=off`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents_new (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'claude' CHECK (
          type IN ('claude', 'codex', 'opencode', 'adk', 'other')
        ),
        description TEXT,
        system_prompt TEXT NOT NULL,
        provider_id TEXT,
        model_id TEXT,
        status_triggers TEXT NOT NULL DEFAULT '',
        tag_triggers TEXT NOT NULL DEFAULT '',
        allowed_tools TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        concurrency_limit INTEGER,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO agents_new (
        id,
        actor_id,
        type,
        description,
        system_prompt,
        provider_id,
        model_id,
        status_triggers,
        tag_triggers,
        allowed_tools,
        is_active,
        concurrency_limit,
        row_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        actor_id,
        type,
        description,
        system_prompt,
        provider_id,
        model_id,
        status_triggers,
        tag_triggers,
        allowed_tools,
        is_active,
        concurrency_limit,
        row_version,
        created_at,
        updated_at,
        deleted_at
      FROM agents
    `);
    await queryRunner.query(`DROP TABLE agents`);
    await queryRunner.query(`ALTER TABLE agents_new RENAME TO agents`);
    await queryRunner.query(`PRAGMA foreign_keys=on`);
  }
}
