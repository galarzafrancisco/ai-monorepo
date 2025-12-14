import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUrlToMcpServers1734184000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add url column to mcp_servers table
    await queryRunner.query(`
      ALTER TABLE mcp_servers
      ADD COLUMN url VARCHAR(2048)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove url column
    await queryRunner.query(`
      ALTER TABLE mcp_servers
      DROP COLUMN url
    `);
  }
}
