import type {
  AgentToolPermissionResponseDto,
  ServerResponseDto,
} from '@taico/client/v2';
import type { RuntimeMcpServerConfig } from '../runners/AgentRunner.js';
import { EXECUTION_ID_HEADER } from './config.js';

export type RuntimeMcpCredentials = {
  executionId: string;
  /** Taico execution token for the agent. */
  accessToken: string;
};

/**
 * Whether Taico authorizes this server, so it should get the agent's Taico
 * execution token and execution ID. Comes from the registry record only,
 * never from the server's URL or name. A backend that predates auth types
 * sends no value; every server there used Taico auth.
 */
export function usesTaicoAuth(server: Pick<ServerResponseDto, 'authType'>): boolean {
  return (server.authType ?? 'taico') === 'taico';
}

/**
 * MCP servers the agent may use, keyed by providedId. Taico-auth HTTP
 * servers get `Authorization: Bearer <execution token>` and the execution ID
 * header. External HTTP servers get neither: a Taico token must not leak to a
 * third party.
 */
export function buildRuntimeMcpServers(
  permissions: AgentToolPermissionResponseDto[],
  serversById: Map<string, ServerResponseDto>,
  credentials: RuntimeMcpCredentials,
): Record<string, RuntimeMcpServerConfig> {
  const mcpServers: Record<string, RuntimeMcpServerConfig> = {};

  for (const permission of permissions) {
    const providedId = permission.server.providedId;
    const server = serversById.get(permission.server.id);
    if (!server) {
      continue;
    }

    if (server.type === 'http' && server.url) {
      mcpServers[providedId] = {
        type: 'http',
        url: server.url,
        headers: usesTaicoAuth(server)
          ? {
              Authorization: `Bearer ${credentials.accessToken}`,
              [EXECUTION_ID_HEADER]: credentials.executionId,
            }
          : {},
      };
      continue;
    }

    if (server.type === 'stdio' && server.cmd) {
      mcpServers[providedId] = {
        type: 'stdio',
        command: server.cmd,
        args: server.args ?? [],
      };
    }
  }

  return mcpServers;
}
