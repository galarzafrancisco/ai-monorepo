import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An MCP authorization flow remembers the workspace its client asked for (a
 * worker started with `--workspace <slug>`), so consent from any other
 * workspace is refused. Null for every existing flow and for clients that
 * don't ask: their token is for the workspace the person consents in.
 * See docs/architecture/workspaces.md.
 */
export class McpAuthFlowRequestedWorkspace1764300000000 implements MigrationInterface {
  name = 'McpAuthFlowRequestedWorkspace1764300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" ADD "requested_workspace_slug" text`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" DROP COLUMN "requested_workspace_slug"`,
    );
  }
}
