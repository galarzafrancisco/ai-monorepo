import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { getConfig } from '../config/env.config';
import { AuthorizationServerMetadataDto } from './dto/authorization-server-metadata.dto';
import { GetAuthorizationServerMetadataParamsDto } from './dto/get-authorization-server-metadata-params.dto';
import { DiscoveryService } from './discovery.service';

@ApiTags('Discovery')
@Controller('.well-known/oauth-authorization-server/mcp')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('issuer')
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

  @Get(':mcpServerId/:version')
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

    return this.discoveryService.getAuthorizationServerMetadata({
      serverIdentifier: params.mcpServerId,
      version: params.version,
      issuer,
      lookupBy,
    });
  }
}
