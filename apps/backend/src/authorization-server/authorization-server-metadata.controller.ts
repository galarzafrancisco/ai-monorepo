import { Controller, Get, Param, Req } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import { AuthorizationServerMetadataDto } from './dto/authorization-server-metadata.dto';
import { GrantType } from './enums';

@ApiTags('Authorization Server')
@Controller('.well-known/oauth-authorization-server')
export class AuthorizationServerMetadataController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  @Get(':mcpServerId')
  @ApiOperation({
    summary:
      'Expose OAuth 2.0 Authorization Server metadata for a registered MCP server',
    description:
      'Provides discovery metadata (RFC 8414) for OAuth 2.0 clients integrating with an MCP server. Accepts either the server UUID or the providedId.',
  })
  @ApiParam({
    name: 'mcpServerId',
    description: 'MCP server UUID or providedId',
  })
  @ApiOkResponse({
    description: 'Authorization server metadata retrieved successfully',
    type: AuthorizationServerMetadataDto,
  })
  async getAuthorizationServerMetadata(
    @Param('mcpServerId') mcpServerId: string,
    @Req() request: Request,
  ): Promise<AuthorizationServerMetadataDto> {
    const server = isUUID(mcpServerId)
      ? await this.mcpRegistryService.getServerById(mcpServerId)
      : await this.mcpRegistryService.getServerByProvidedId(mcpServerId);

    const baseUrl = this.resolveBaseUrl(request);

    const serverIdentifier = server.providedId ?? server.id;

    return {
      issuer: `${baseUrl}/v1/${serverIdentifier}`,
      authorization_endpoint: `${baseUrl}/v1/authorize/${serverIdentifier}`,
      registration_endpoint: `${baseUrl}/v1/register/${serverIdentifier}`,
      scopes_supported: (server.scopes ?? [])
        .map((scope) => scope.scopeId)
        .sort(),
      response_types_supported: ['code'],
      grant_types_supported: [
        GrantType.AUTHORIZATION_CODE,
        GrantType.REFRESH_TOKEN,
      ],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  private resolveBaseUrl(request: Request): string {
    const forwardedProto = this.firstHeaderValue(
      request.headers['x-forwarded-proto'],
    );
    const protocol = forwardedProto ?? request.protocol;

    const forwardedHost = this.firstHeaderValue(
      request.headers['x-forwarded-host'],
    );
    const host = forwardedHost ?? request.get('host') ?? 'localhost';

    const normalizedHost = host.replace(/\/+$/, '');

    return `${protocol}://${normalizedHost}/api`;
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
