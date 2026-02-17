import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRoleFromThreadMessage1739844333000
  implements MigrationInterface
{
  name = 'RemoveRoleFromThreadMessage1739844333000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE thread_messages_new (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by_actor_id TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO thread_messages_new (
        id, thread_id, content, created_by_actor_id, created_at
      )
      SELECT id, thread_id, content, created_by_actor_id, created_at
      FROM thread_messages
    `);

    await queryRunner.query(`DROP TABLE thread_messages`);

    await queryRunner.query(`ALTER TABLE thread_messages_new RENAME TO thread_messages`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id
        ON thread_messages(thread_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at
        ON thread_messages(created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS thread_messages`);

    await queryRunner.query(`
      CREATE TABLE thread_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by_actor_id TEXT,
        role TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id
        ON thread_messages(thread_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at
        ON thread_messages(created_at)
    `);
  }
}
