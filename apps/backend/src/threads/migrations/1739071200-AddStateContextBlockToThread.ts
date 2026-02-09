import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStateContextBlockToThread1739071200
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add the state_context_block_id column as nullable initially
    await queryRunner.query(`
      ALTER TABLE threads ADD COLUMN state_context_block_id TEXT
    `);

    // Step 2: Backfill - create a state context block for each existing thread
    const threads = await queryRunner.query(`
      SELECT id, title, created_by_actor_id, created_at
      FROM threads
      WHERE deleted_at IS NULL
    `);

    for (const thread of threads) {
      // Generate a UUID for the context block
      const contextBlockId = this.generateUuid();

      // Create the state context block
      await queryRunner.query(
        `
        INSERT INTO context_blocks (
          id,
          title,
          content,
          created_by_actor_id,
          parent_id,
          "order",
          row_version,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, NULL, 0, 1, ?, ?)
      `,
        [
          contextBlockId,
          `State: ${thread.title}`,
          'This thread was created to track work.',
          thread.created_by_actor_id,
          thread.created_at,
          thread.created_at,
        ],
      );

      // Link the thread to its state context block
      await queryRunner.query(
        `
        UPDATE threads
        SET state_context_block_id = ?
        WHERE id = ?
      `,
        [contextBlockId, thread.id],
      );
    }

    // Step 3: Make the column NOT NULL
    // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
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

    // Copy data to new table
    await queryRunner.query(`
      INSERT INTO threads_new (id, title, created_by_actor_id, state_context_block_id, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, created_by_actor_id, state_context_block_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);

    // Drop old table
    await queryRunner.query(`DROP TABLE threads`);

    // Rename new table
    await queryRunner.query(`ALTER TABLE threads_new RENAME TO threads`);

    // Recreate indices
    await queryRunner.query(`
      CREATE INDEX idx_threads_created_by_actor ON threads(created_by_actor_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_threads_state_context_block ON threads(state_context_block_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate table without state_context_block_id
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

    // Copy data back (excluding state_context_block_id)
    await queryRunner.query(`
      INSERT INTO threads_old (id, title, created_by_actor_id, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, created_by_actor_id, row_version, created_at, updated_at, deleted_at
      FROM threads
    `);

    // Delete the state context blocks that were created
    await queryRunner.query(`
      DELETE FROM context_blocks
      WHERE id IN (
        SELECT state_context_block_id FROM threads
      )
    `);

    // Drop new table
    await queryRunner.query(`DROP TABLE threads`);

    // Rename old table back
    await queryRunner.query(`ALTER TABLE threads_old RENAME TO threads`);

    // Recreate index
    await queryRunner.query(`
      CREATE INDEX idx_threads_created_by_actor ON threads(created_by_actor_id)
    `);
  }

  private generateUuid(): string {
    // Simple UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
