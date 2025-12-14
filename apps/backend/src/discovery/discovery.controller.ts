import { Controller, Get, Logger, Param, Req } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { AuthorizationServerMetadataDto } from './dto/authorization-server-metadata.dto';
import { GetAuthorizationServerMetadataParamsDto } from './dto/get-authorization-server-metadata-params.dto';
import { DiscoveryService } from './discovery.service';

@ApiTags('Discovery')
@Controller('.well-known/oauth-authorization-server/mcp')
export class DiscoveryController {
  private logger = new Logger(DiscoveryController.name);
  constructor(private readonly discoveryService: DiscoveryService) {}

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
    @Req() request: Request,
  ): Promise<AuthorizationServerMetadataDto> {
    const issuer = this.resolveIssuer(request);
    const lookupBy = isUUID(params.mcpServerId) ? 'id' : 'providedId';

    return this.discoveryService.getAuthorizationServerMetadata({
      serverIdentifier: params.mcpServerId,
      version: params.version,
      issuer,
      lookupBy,
    });
  }

  private resolveIssuer(request: Request): string {
    const forwardedProto = this.firstHeaderValue(
      request.headers['x-forwarded-proto'],
    );
    const protocol = forwardedProto ?? request.protocol;

    const forwardedHost = this.firstHeaderValue(
      request.headers['x-forwarded-host'],
    );
    const host = forwardedHost ?? request.get('host') ?? 'localhost';

    const normalizedHost = host.replace(/\/+$/, '');

    return `${protocol}://${normalizedHost}`;
  }

  private firstHeaderValue(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (!headerValue) {
      return undefined;
    }

    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    return headerValue.split(',')[0]?.trim();
  }
}
