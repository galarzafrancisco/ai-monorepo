import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentToolPermissions1742000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_tool_permissions (
        agent_actor_id text NOT NULL,
        server_id text NOT NULL,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (agent_actor_id, server_id),
        CONSTRAINT fk_agent_tool_permissions_agent_actor_id
          FOREIGN KEY (agent_actor_id) REFERENCES agents(actor_id) ON DELETE CASCADE,
        CONSTRAINT fk_agent_tool_permissions_server_id
          FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_tool_permission_scopes (
        agent_actor_id text NOT NULL,
        server_id text NOT NULL,
        scope_id varchar(255) NOT NULL,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (agent_actor_id, server_id, scope_id),
        CONSTRAINT fk_agent_tool_permission_scopes_permission
          FOREIGN KEY (agent_actor_id, server_id)
          REFERENCES agent_tool_permissions(agent_actor_id, server_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_agent_tool_permission_scopes_scope
          FOREIGN KEY (scope_id, server_id)
          REFERENCES mcp_scopes(id, serverId)
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS agent_tool_permission_scopes');
    await queryRunner.query('DROP TABLE IF EXISTS agent_tool_permissions');
  }
}
