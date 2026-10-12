import { Injectable } from '@nestjs/common';
import {
  GrantType,
  TokenEndpointAuthMethod,
} from '../authorization-server/enums';
import { CLIENT_ASSERTION_SIGNING_ALGORITHMS } from '../authorization-server/utils/client-assertion';
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
import { MCP_AUTH_SERVER_VERSION } from 'src/auth/core/resource-audience';
import { InvalidServerConfigurationError } from 'src/mcp-registry/errors/mcp-registry.errors';
import {
  createInternalWorkerAuthScopes,
  createInternalWorkerAuthTarget,
  createDisplayAuthScopes,
  createDisplayAuthTarget,
} from 'src/app-init/mcp/internal-worker-auth.mcp';

@Injectable()
export class DiscoveryService {
  private readonly systemServers: SystemServer[] = [];
  constructor(private readonly mcpRegistryService: McpRegistryService) {
    this.populateSystemServers();
  }

  private populateSystemServers() {
    this.populateSystemServer(
      createInternalWorkerAuthTarget(),
      createInternalWorkerAuthScopes,
    );
    this.populateSystemServer(
      createDisplayAuthTarget(),
      createDisplayAuthScopes,
    );
    this.populateSystemServer(createTasks(), createTasksScopes);
    this.populateSystemServer(createContext(), createContextScopes);
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
          `${config.issuerUrl}/mcp/${server.providedId}/${MCP_AUTH_SERVER_VERSION}`,
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
      // RFC 8414: must be identical to the identifier the client built the
      // well-known URL from, i.e. what protected resource metadata advertises.
      issuer: `${input.issuer}/mcp/${input.serverIdentifier}/${input.version}`,
      authorization_endpoint: `${input.issuer}/api/v1/auth/authorize/mcp/${serverIdentifier}/${input.version}`,
      token_endpoint: `${input.issuer}/api/v1/auth/token/mcp/${serverIdentifier}/${input.version}`,
      registration_endpoint: `${input.issuer}/api/v1/auth/clients/register/mcp/${serverIdentifier}/${input.version}`,
      scopes_supported: scopes,
      response_types_supported: ['code'],
      grant_types_supported: [
        GrantType.AUTHORIZATION_CODE,
        GrantType.REFRESH_TOKEN,
      ],
      // Public clients, and metadata document clients that sign a JWT with
      // a key they publish. Neither involves a shared secret.
      token_endpoint_auth_methods_supported: [
        TokenEndpointAuthMethod.NONE,
        TokenEndpointAuthMethod.PRIVATE_KEY_JWT,
      ],
      token_endpoint_auth_signing_alg_values_supported:
        CLIENT_ASSERTION_SIGNING_ALGORITHMS,
      code_challenge_methods_supported: ['S256'],
      // Clients may identify themselves with a URL to a metadata document
      // they host instead of registering first.
      client_id_metadata_document_supported: true,
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
