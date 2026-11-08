import { MigrationInterface, QueryRunner } from 'typeorm';
import { SEARCH_WORKSPACE_SCHEMA_STATEMENTS } from '../search/index/search-schema';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Workspaces phase 3e: GitHub data and the MCP registry get a `workspace_id`,
 * and so does every search index row.
 *
 * Until now these modules only answered the default workspace, so every
 * existing row moves to it as it is.
 *
 * - GitHub: connections, webhook sources, pull requests, issues and the
 *   places they are linked from. A pull request or issue is cached once per
 *   workspace (unique on workspace and key), read with that workspace's
 *   connections.
 * - MCP registry: servers, scopes, connections and scope mappings. A server's
 *   `providedId` stays unique across the installation: it names an OAuth
 *   resource in URLs that carry no workspace. A connection's `providedId`
 *   becomes unique per workspace.
 * - Search: index rows carry the workspace of the item they describe.
 *
 * See docs/architecture/workspaces.md, "Integrations, MCP registry and search (phase 3e)".
 */
const TABLES = [
  'github_connections',
  'github_webhook_sources',
  'pull_requests',
  'pull_request_references',
  'issues',
  'issue_references',
  'mcp_servers',
  'mcp_scopes',
  'mcp_connections',
  'mcp_scope_mappings',
] as const;

export class WorkspaceScopeIntegrationsMcpSearch1764000000000 implements MigrationInterface {
  name = 'WorkspaceScopeIntegrationsMcpSearch1764000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "workspace_id" uuid NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`,
      );
      // New rows have to say where they belong.
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "workspace_id" DROP DEFAULT`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT`,
      );
      await queryRunner.query(`CREATE INDEX "IDX_${table}_workspace" ON "${table}" ("workspace_id")`);
    }

    // A pull request or issue is cached once per workspace.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_pull_requests_key"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pull_requests_workspace_key" ON "pull_requests" ("workspace_id", "key")`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_issues_key"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_issues_workspace_key" ON "issues" ("workspace_id", "key")`);

    // A downstream connection's provided id is unique in its workspace.
    await this.dropUniqueConstraintsOn(queryRunner, 'mcp_connections', 'providedId');
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_mcp_connections_workspace_provided_id" ON "mcp_connections" ("workspace_id", "providedId")`,
    );

    for (const statement of SEARCH_WORKSPACE_SCHEMA_STATEMENTS) {
      await queryRunner.query(statement);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_documents_workspace_result"`);
    await queryRunner.query(`ALTER TABLE "search_documents" DROP COLUMN IF EXISTS "workspace_id"`);

    await queryRunner.query(`DROP INDEX "UQ_mcp_connections_workspace_provided_id"`);
    await queryRunner.query(
      `ALTER TABLE "mcp_connections" ADD CONSTRAINT "UQ_da19f3d0d9d03f4918f7960b77a" UNIQUE ("providedId")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_issues_workspace_key"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_issues_key" ON "issues" ("key")`);
    await queryRunner.query(`DROP INDEX "UQ_pull_requests_workspace_key"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_pull_requests_key" ON "pull_requests" ("key")`);

    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "workspace_id"`);
    }
  }

  /** Drops every single-column unique constraint on a column, whatever it is named. */
  private async dropUniqueConstraintsOn(queryRunner: QueryRunner, table: string, column: string): Promise<void> {
    const rows: Array<{ name: string }> = await queryRunner.query(
      `SELECT c.conname AS name
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE t.relname = $1 AND c.contype = 'u' AND a.attname = $2 AND array_length(c.conkey, 1) = 1`,
      [table, column],
    );
    for (const { name } of rows) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`);
    }
  }
}
