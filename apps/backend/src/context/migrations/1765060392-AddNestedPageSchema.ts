import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from 'typeorm';

export class AddNestedPageSchema1765060392 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove unique constraint from title
    await queryRunner.query(`
      CREATE TABLE wiki_pages_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        parent_id TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME
      )
    `);

    // Copy existing data
    await queryRunner.query(`
      INSERT INTO wiki_pages_new (id, title, content, author, parent_id, "order", row_version, created_at, updated_at, deleted_at)
      SELECT id, title, content, author, NULL, 0, row_version, created_at, updated_at, deleted_at
      FROM wiki_pages
    `);

    // Drop old table
    await queryRunner.query(`DROP TABLE wiki_pages`);

    // Rename new table
    await queryRunner.query(`ALTER TABLE wiki_pages_new RENAME TO wiki_pages`);

    // Create composite unique constraint on (parent_id, title)
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_wiki_pages_parent_title ON wiki_pages(parent_id, title)
    `);

    // Create index on parent_id for query performance
    await queryRunner.query(`
      CREATE INDEX idx_wiki_pages_parent_id ON wiki_pages(parent_id)
    `);

    // Create index on (parent_id, order) for ordered queries
    await queryRunner.query(`
      CREATE INDEX idx_wiki_pages_parent_order ON wiki_pages(parent_id, "order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate original table structure
    await queryRunner.query(`
      CREATE TABLE wiki_pages_old (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME
      )
    `);

    // Copy data back (only root pages since we're removing the hierarchy)
    await queryRunner.query(`
      INSERT INTO wiki_pages_old (id, title, content, author, row_version, created_at, updated_at, deleted_at)
      SELECT id, title, content, author, row_version, created_at, updated_at, deleted_at
      FROM wiki_pages
      WHERE parent_id IS NULL
    `);

    // Drop new table
    await queryRunner.query(`DROP TABLE wiki_pages`);

    // Rename old table back
    await queryRunner.query(`ALTER TABLE wiki_pages_old RENAME TO wiki_pages`);
  }
}
