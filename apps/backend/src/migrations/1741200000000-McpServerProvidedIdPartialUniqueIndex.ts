import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replace the column-level UNIQUE constraint on mcp_servers.providedId with a
 * partial unique index that only covers non-deleted rows.
 *
 * This allows a new server to reuse the providedId of a soft-deleted server.
 */
export class McpServerProvidedIdPartialUniqueIndex1741200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys=off');

    // Recreate the table without the UNIQUE constraint on providedId
    await queryRunner.query(`
      CREATE TABLE mcp_servers_new (
        id TEXT PRIMARY KEY,
        providedId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'http',
        url VARCHAR(2048),
        cmd VARCHAR(1024),
        args TEXT,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME
      )
    `);

    await queryRunner.query(`
      INSERT INTO mcp_servers_new
        (id, providedId, name, description, type, url, cmd, args, createdAt, updatedAt, deletedAt)
      SELECT
        id, providedId, name, description, type, url, cmd, args, createdAt, updatedAt, deletedAt
      FROM mcp_servers
    `);

    await queryRunner.query('DROP TABLE mcp_servers');
    await queryRunner.query('ALTER TABLE mcp_servers_new RENAME TO mcp_servers');

    // Partial unique index: only active (non-deleted) servers must have unique providedIds
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_mcp_servers_providedId_active
      ON mcp_servers (providedId)
      WHERE deletedAt IS NULL
    `);

    await queryRunner.query('PRAGMA foreign_keys=on');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys=off');

    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_mcp_servers_providedId_active',
    );

    await queryRunner.query(`
      CREATE TABLE mcp_servers_old (
        id TEXT PRIMARY KEY,
        providedId VARCHAR(255) UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'http',
        url VARCHAR(2048),
        cmd VARCHAR(1024),
        args TEXT,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME
      )
    `);

    await queryRunner.query(`
      INSERT INTO mcp_servers_old
        (id, providedId, name, description, type, url, cmd, args, createdAt, updatedAt, deletedAt)
      SELECT
        id, providedId, name, description, type, url, cmd, args, createdAt, updatedAt, deletedAt
      FROM mcp_servers
    `);

    await queryRunner.query('DROP TABLE mcp_servers');
    await queryRunner.query('ALTER TABLE mcp_servers_old RENAME TO mcp_servers');

    await queryRunner.query('PRAGMA foreign_keys=on');
  }
}
