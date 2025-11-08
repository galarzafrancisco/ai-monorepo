import { Injectable } from '@nestjs/common';
import { GrantType } from '../authorization-server/enums';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import {
  AuthorizationServerMetadataResult,
  GetAuthorizationServerMetadataInput,
} from './dto/service/discovery.service.types';

@Injectable()
export class DiscoveryService {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

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
      .map((scope) => scope.scopeId)
      .sort((a, b) => a.localeCompare(b));

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
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'private_key_jwt',
      ],
      code_challenge_methods_supported: ['S256'],
    };
  }
}
