import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThreadStateContextBlock1765302800
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys=OFF');

    await queryRunner.query(
      `ALTER TABLE threads ADD COLUMN state_context_block_id TEXT`,
    );

    const threads: Array<{ id: string; created_by_actor_id: string }> =
      await queryRunner.query(
        `SELECT id, created_by_actor_id FROM threads`,
      );

    const createdAt = new Date().toISOString();

    for (const thread of threads) {
      const blockId = randomUUID();
      await queryRunner.query(
        `INSERT INTO context_blocks (
          id,
          title,
          content,
          parent_id,
          "order",
          created_by_actor_id,
          assignee_actor_id,
          row_version,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          blockId,
          'Thread state',
          'This thread was created to track work.',
          null,
          0,
          thread.created_by_actor_id,
          null,
          1,
          createdAt,
          createdAt,
          null,
        ],
      );

      await queryRunner.query(
        `UPDATE threads SET state_context_block_id = ? WHERE id = ?`,
        [blockId, thread.id],
      );
    }

    await queryRunner.query(`
      CREATE TABLE threads_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        state_context_block_id TEXT NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (state_context_block_id) REFERENCES context_blocks(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      INSERT INTO threads_new (
        id,
        title,
        created_by_actor_id,
        state_context_block_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        title,
        created_by_actor_id,
        state_context_block_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      FROM threads
    `);

    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);
    await queryRunner.query('PRAGMA foreign_keys=ON');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys=OFF');

    const rows: Array<{ state_context_block_id: string }> =
      await queryRunner.query(
        `SELECT state_context_block_id FROM threads WHERE state_context_block_id IS NOT NULL`,
      );

    const blockIds = rows
      .map((row) => row.state_context_block_id)
      .filter((id) => id);

    if (blockIds.length > 0) {
      const placeholders = blockIds.map(() => '?').join(', ');
      await queryRunner.query(
        `DELETE FROM context_blocks WHERE id IN (${placeholders})`,
        blockIds,
      );
    }

    await queryRunner.query(`
      CREATE TABLE threads_old (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO threads_old (
        id,
        title,
        created_by_actor_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        title,
        created_by_actor_id,
        row_version,
        created_at,
        updated_at,
        deleted_at
      FROM threads
    `);

    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_old RENAME TO threads`);
    await queryRunner.query('PRAGMA foreign_keys=ON');
  }
}
