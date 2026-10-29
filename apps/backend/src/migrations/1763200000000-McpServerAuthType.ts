import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records whether an MCP server uses Taico as its authorization server.
 * Every existing server keeps Taico auth.
 */
export class McpServerAuthType1763200000000 implements MigrationInterface {
  name = 'McpServerAuthType1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "authType" text`,
    );
    await queryRunner.query(
      `UPDATE "mcp_servers" SET "authType" = 'taico' WHERE "authType" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_servers" ALTER COLUMN "authType" SET DEFAULT 'taico'`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_servers" ALTER COLUMN "authType" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mcp_servers" DROP COLUMN IF EXISTS "authType"`,
    );
  }
}
