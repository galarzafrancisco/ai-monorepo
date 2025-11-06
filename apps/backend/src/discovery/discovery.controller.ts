import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Req,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { AuthorizationServerMetadataDto } from './dto/authorization-server-metadata.dto';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import { GrantType } from '../authorization-server/enums';
import { ServerNotFoundError } from '../mcp-registry/errors/mcp-registry.errors';

@ApiTags('Discovery')
@Controller('.well-known/oauth-authorization-server/mcp')
export class DiscoveryController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

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
    @Param('mcpServerId') mcpServerId: string,
    @Param('version') version: string,
    @Req() request: Request,
  ): Promise<AuthorizationServerMetadataDto> {
    try {
      const server = isUUID(mcpServerId)
        ? await this.mcpRegistryService.getServerById(mcpServerId)
        : await this.mcpRegistryService.getServerByProvidedId(mcpServerId);

      const issuer = this.resolveIssuer(request);
      const serverIdentifier = server.providedId ?? server.id;

      return {
        issuer,
        authorization_endpoint: `${issuer}/api/v1/authorize/mcp/${serverIdentifier}/${version}`,
        token_endpoint: `${issuer}/api/v1/token/mcp/${serverIdentifier}/${version}`,
        registration_endpoint: `${issuer}/api/v1/register/mcp/${serverIdentifier}/${version}`,
        scopes_supported: (server.scopes ?? [])
          .map((scope) => scope.scopeId)
          .sort((left, right) => left.localeCompare(right)),
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
    } catch (error) {
      if (error instanceof ServerNotFoundError) {
        throw new HttpException(
          {
            error: 'not_found',
            error_description: `Unknown MCP server '${mcpServerId}' version '${version}'.`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      throw error;
    }
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
