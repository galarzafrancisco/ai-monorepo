import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThreadStateContextBlock1739059200
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add the column as nullable initially to allow backfill
    await queryRunner.query(`
      ALTER TABLE threads ADD COLUMN state_context_block_id TEXT
    `);

    // Step 2: Get all existing threads and create state blocks for them
    const threads = await queryRunner.query(`
      SELECT id, title, created_by_actor_id, created_at FROM threads
    `);

    for (const thread of threads) {
      // Create a state context block for each thread
      const blockId = this.generateUUID();
      const content = 'This thread was created to track work.';

      await queryRunner.query(
        `
        INSERT INTO context_blocks (id, title, content, created_by_actor_id, "order", row_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 1, ?, ?)
      `,
        [
          blockId,
          `${thread.title} - State`,
          content,
          thread.created_by_actor_id,
          thread.created_at,
          thread.created_at,
        ],
      );

      // Update the thread with the state block ID
      await queryRunner.query(
        `
        UPDATE threads SET state_context_block_id = ? WHERE id = ?
      `,
        [blockId, thread.id],
      );
    }

    // Step 3: Make the column NOT NULL now that all rows have values
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
      INSERT INTO threads_new (id, title, created_by_actor_id, state_context_block_id, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, created_by_actor_id, state_context_block_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);

    // Preserve existing join tables
    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    // Step 4: Create index on state_context_block_id for query performance
    await queryRunner.query(`
      CREATE INDEX idx_threads_state_context_block ON threads(state_context_block_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the FK constraint and column
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
      INSERT INTO threads_old (id, title, created_by_actor_id, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, created_by_actor_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);

    // Get state block IDs to delete
    const stateBlocks = await queryRunner.query(`
      SELECT state_context_block_id FROM threads
    `);

    await queryRunner.query(`DROP TABLE threads`);
    await queryRunner.query(`ALTER TABLE threads_old RENAME TO threads`);

    // Delete the state context blocks that were created for threads
    for (const block of stateBlocks) {
      await queryRunner.query(
        `DELETE FROM context_blocks WHERE id = ?`,
        [block.state_context_block_id],
      );
    }
  }

  private generateUUID(): string {
    // Simple UUID v4 generator for SQLite compatibility
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
