import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProvidedIdToMcpConnections1733964000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add providedId column to mcp_connections table
    await queryRunner.query(`
      ALTER TABLE mcp_connections
      ADD COLUMN provided_id VARCHAR(255) UNIQUE
    `);

    // Create index on providedId for faster lookups
    await queryRunner.query(`
      CREATE INDEX idx_mcp_connections_provided_id ON mcp_connections(provided_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`
      DROP INDEX idx_mcp_connections_provided_id
    `);

    // Remove providedId column
    await queryRunner.query(`
      ALTER TABLE mcp_connections
      DROP COLUMN provided_id
    `);
  }
}
