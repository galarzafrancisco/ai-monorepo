import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpServerTransportConfig1740500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE mcp_servers ADD COLUMN type TEXT NOT NULL DEFAULT 'http'",
    );
    await queryRunner.query(
      'ALTER TABLE mcp_servers ADD COLUMN cmd VARCHAR(1024)',
    );
    await queryRunner.query('ALTER TABLE mcp_servers ADD COLUMN args TEXT');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys=off');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_servers_old (
        id TEXT PRIMARY KEY,
        providedId VARCHAR(255) UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        url VARCHAR(2048),
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME
      )
    `);

    await queryRunner.query(`
      INSERT INTO mcp_servers_old (
        id,
        providedId,
        name,
        description,
        url,
        createdAt,
        updatedAt,
        deletedAt
      )
      SELECT
        id,
        providedId,
        name,
        description,
        url,
        createdAt,
        updatedAt,
        deletedAt
      FROM mcp_servers
    `);

    await queryRunner.query('DROP TABLE mcp_servers');
    await queryRunner.query('ALTER TABLE mcp_servers_old RENAME TO mcp_servers');
    await queryRunner.query('PRAGMA foreign_keys=on');
  }
}
