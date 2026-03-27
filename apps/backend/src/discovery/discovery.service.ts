import { Injectable } from '@nestjs/common';
import { GrantType } from '../authorization-server/enums';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import {
  AuthorizationServerMetadataResult,
  GetAuthorizationServerMetadataInput,
  ProtectedResourceMetadataResult,
  SystemServer,
} from './dto/service/discovery.service.types';
import { createTasks, createTasksScopes } from 'src/app-init/mcp/tasks.mcp';
import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';
import {
  createContext,
  createContextScopes,
} from 'src/app-init/mcp/context.mcp';
import { Scope } from 'src/auth/core/types/scope.type';
import { InvalidServerConfigurationError } from 'src/mcp-registry/errors/mcp-registry.errors';
import {
  createInternalWorkerAuthScopes,
  createInternalWorkerAuthTarget,
} from 'src/app-init/mcp/internal-worker-auth.mcp';

@Injectable()
export class DiscoveryService {
  private readonly systemServers: SystemServer[] = [];
  constructor(private readonly mcpRegistryService: McpRegistryService) {
    this.populateSystemServers();
  }

  private populateSystemServers() {
    this.populateSystemServer(
      createInternalWorkerAuthTarget,
      createInternalWorkerAuthScopes,
    );
    this.populateSystemServer(createTasks, createTasksScopes);
    this.populateSystemServer(createContext, createContextScopes);
  }

  private populateSystemServer(server: CreateServerInput, scopes: Scope[]) {
    const config = getConfig();
    if (server.type !== 'http') {
      return;
    }

    if (!server.url) {
      return;
    }
    const systemServer: SystemServer = {
      path: new URL(server.url).pathname,
      metadata: {
        resource: server.url,
        // No need to add the .well-known/oauth-authorization-server part, the client will add it automatically
        authorization_servers: [
          `${config.issuerUrl}/mcp/${server.providedId}/0.0.0`,
        ],
        scopes_supported: scopes.map((s) => s.id),
        bearer_methods_supported: ['header'],
        resource_name: server.name,
      },
    };
    this.systemServers.push(systemServer);
  }

  async getAuthorizationServerMetadata(
    input: GetAuthorizationServerMetadataInput,
  ): Promise<AuthorizationServerMetadataResult> {
    const server =
      input.lookupBy === 'id'
        ? await this.mcpRegistryService.getServerById(input.serverIdentifier)
        : await this.mcpRegistryService.getServerByProvidedId(
            input.serverIdentifier,
          );

    const serverIdentifier = server.providedId ?? server.id;
    const scopes = (server.scopes ?? [])
      .map((scope) => scope.id)
      .sort((a, b) => a.localeCompare(b));

    if (server.type !== 'http') {
      throw new InvalidServerConfigurationError(
        `MCP server '${serverIdentifier}' is a stdio server and does not expose OAuth metadata.`,
      );
    }

    return {
      issuer: input.issuer,
      authorization_endpoint: `${input.issuer}/api/v1/auth/authorize/mcp/${serverIdentifier}/${input.version}`,
      token_endpoint: `${input.issuer}/api/v1/auth/token/mcp/${serverIdentifier}/${input.version}`,
      registration_endpoint: `${input.issuer}/api/v1/auth/clients/register/mcp/${serverIdentifier}/${input.version}`,
      scopes_supported: scopes,
      response_types_supported: ['code'],
      grant_types_supported: [
        GrantType.AUTHORIZATION_CODE,
        GrantType.REFRESH_TOKEN,
      ],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  private findSystemServer(pathParts: string[]): SystemServer | null {
    const path = `/${pathParts.join('/')}`;

    const server = this.systemServers.find((server) => {
      return server.path === path;
    });

    if (server) {
      return server;
    }

    return null;
  }

  async getProtectedResourceMetadata(
    path: string[],
  ): Promise<ProtectedResourceMetadataResult | null> {
    return this.findSystemServer(path)?.metadata || null;
  }
}
