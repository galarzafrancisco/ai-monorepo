import { Injectable, Logger } from '@nestjs/common';
import { ToolSet } from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';
import { getConfig } from 'src/config/env.config';
import { IssuedAccessTokenService } from 'src/authorization-server/issued-access-token.service';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { ALL_TASKS_SCOPES } from 'src/tasks/tasks.scopes';
import { ALL_CONTEXT_SCOPES } from 'src/context/context.scopes';
import { ActorType } from 'src/identity-provider/enums';

export type McpActor = {
  id: string;
  slug: string;
  type: ActorType;
  displayName: string;
};

export type TaicoMcpTools = {
  tools: ToolSet;
  close: () => Promise<void>;
};

const MCP_SERVERS = [
  { prefix: 'tasks', path: '/api/v1/tasks/tasks/mcp' },
  { prefix: 'context', path: '/api/v1/context/blocks/mcp' },
] as const;

/**
 * Gives an agent run Taico's own MCP tools, authenticated with a short-lived
 * token so the run goes through the same access control as any other client.
 */
@Injectable()
export class TaicoMcpToolsFactory {
  private readonly logger = new Logger(TaicoMcpToolsFactory.name);

  constructor(
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
  ) {}

  /** Tools are exposed as `<server>__<tool>`, e.g. `tasks__list_tasks_by_thread`. */
  async open(input: { subject: McpActor; issuedBy: McpActor }): Promise<TaicoMcpTools> {
    const token = await this.issuedAccessTokenService.issueSystemToken({
      subjectActor: input.subject,
      issuedByActor: input.issuedBy,
      scopes: [
        McpScopes.USE.id,
        ...ALL_TASKS_SCOPES.map((s) => s.id),
        ...ALL_CONTEXT_SCOPES.map((s) => s.id),
      ],
    });

    const baseUrl = getConfig().issuerUrl;
    const clients: Array<Awaited<ReturnType<typeof createMCPClient>>> = [];
    const close = async (): Promise<void> => {
      await Promise.all(
        clients.map((client) =>
          client.close().catch((error) => {
            this.logger.warn({
              message: 'Failed to close MCP client',
              error: error instanceof Error ? error.message : String(error),
            });
          }),
        ),
      );
    };

    try {
      const tools: ToolSet = {};

      for (const server of MCP_SERVERS) {
        const client = await createMCPClient({
          transport: {
            type: 'http',
            url: `${baseUrl}${server.path}`,
            headers: { Authorization: `Bearer ${token.token}` },
          },
        });
        clients.push(client);

        for (const [name, tool] of Object.entries(await client.tools())) {
          tools[`${server.prefix}__${name}`] = tool;
        }
      }

      return { tools, close };
    } catch (error) {
      await close();
      throw error;
    }
  }
}
