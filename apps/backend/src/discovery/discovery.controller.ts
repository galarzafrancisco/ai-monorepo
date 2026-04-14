import {
  All,
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { getConfig } from '../config/env.config';
import { AuthorizationServerMetadataDto } from './dto/authorization-server-metadata.dto';
import { ProtectedResourceMetadataResponseDto } from './dto/protected-resource-metadata-response.dto';
import { GetAuthorizationServerMetadataParamsDto } from './dto/get-authorization-server-metadata-params.dto';
import { DiscoveryService } from './discovery.service';
import {
  AuthorizationServerMetadataResult,
  ProtectedResourceMetadataResult,
} from './dto/service/discovery.service.types';

@ApiTags('Discovery')
@Controller('.well-known')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('oauth-authorization-server/mcp/issuer')
  @ApiOperation({
    summary: 'Get the authorization server issuer URL',
    description:
      'Returns the configured authorization server issuer URL from environment configuration',
  })
  @ApiOkResponse({
    description: 'Issuer URL retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        issuer: { type: 'string', example: 'http://localhost:4000' },
      },
    },
  })
  getIssuer(): { issuer: string } {
    const config = getConfig();
    return { issuer: config.issuerUrl };
  }

  @Get('oauth-authorization-server/mcp/:mcpServerId/:version')
  @ApiOperation({
    summary:
      'Expose OAuth 2.0 Authorization Server metadata for a registered MCP server version',
    description:
      'Provides discovery metadata (RFC 8414) for OAuth 2.0 clients integrating with a specific MCP server version. Accepts either the server UUID or the providedId.',
  })
  @ApiParam({
    name: 'mcpServerId',
    description: 'MCP server UUID or providedId',
  })
  @ApiParam({
    name: 'version',
    description: 'Semantic version of the MCP server',
  })
  @ApiOkResponse({
    description: 'Authorization server metadata retrieved successfully',
    type: AuthorizationServerMetadataDto,
  })
  async getAuthorizationServerMetadata(
    @Param() params: GetAuthorizationServerMetadataParamsDto,
  ): Promise<AuthorizationServerMetadataDto> {
    const config = getConfig();
    const issuer = config.issuerUrl;
    const lookupBy = isUUID(params.mcpServerId) ? 'id' : 'providedId';

    const metadata = await this.discoveryService.getAuthorizationServerMetadata(
      {
        serverIdentifier: params.mcpServerId,
        version: params.version,
        issuer,
        lookupBy,
      },
    );

    return this.mapAuthorizationServerMetadataToResponse(metadata);
  }

  // @Get('oauth-protected-resource/:resource')
  // @ApiParam({
  //   name: 'resource',
  //   description: 'path of the endpoint'
  // })
  // async getProtectedResourceMetadata(
  //   @Param() param: GetProtectedResourceMetadataParamsDto,
  // ): Promise<any> {
  //   return {
  //     message: 'gday'
  //   }
  // }

  @Get('oauth-protected-resource/*path')
  @ApiOkResponse({
    description: 'Protected resource metadata retrieved successfully',
    type: ProtectedResourceMetadataResponseDto,
  })
  async all(
    @Param('path') path: string[],
  ): Promise<ProtectedResourceMetadataResponseDto> {
    /*
    MCP Clients should fetch protected resource metadata form the endpoint present in the WWW-Authenticate header, but they don't.
    Instead they default to finding it under ./well-known/oauth-protected-resource/{path-of-the-original-resource}.
    This hack attempts to catch that path and respond with the right metadata.
    */
    const meta = await this.discoveryService.getProtectedResourceMetadata(path);
    if (!meta) {
      throw new NotFoundException();
    }
    return this.mapProtectedResourceMetadataToResponse(meta);
  }

  private mapAuthorizationServerMetadataToResponse(
    metadata: AuthorizationServerMetadataResult,
  ): AuthorizationServerMetadataDto {
    return {
      issuer: metadata.issuer,
      authorization_endpoint: metadata.authorization_endpoint,
      token_endpoint: metadata.token_endpoint,
      registration_endpoint: metadata.registration_endpoint,
      scopes_supported: metadata.scopes_supported,
      response_types_supported: metadata.response_types_supported,
      grant_types_supported: metadata.grant_types_supported,
      token_endpoint_auth_methods_supported:
        metadata.token_endpoint_auth_methods_supported,
      code_challenge_methods_supported: metadata.code_challenge_methods_supported,
    };
  }

  private mapProtectedResourceMetadataToResponse(
    metadata: ProtectedResourceMetadataResult,
  ): ProtectedResourceMetadataResponseDto {
    return {
      resource: metadata.resource,
      authorization_servers: metadata.authorization_servers,
      scopes_supported: metadata.scopes_supported,
      bearer_methods_supported: metadata.bearer_methods_supported,
      resource_name: metadata.resource_name,
    };
  }
}
