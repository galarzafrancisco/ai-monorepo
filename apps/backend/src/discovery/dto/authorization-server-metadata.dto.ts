import { ApiProperty } from '@nestjs/swagger';
import { GrantType } from '../../authorization-server/enums';

export class AuthorizationServerMetadataDto {
  @ApiProperty({
    description: 'Issuer identifier for the MCP authorization server',
    example: 'https://auth.example.com',
  })
  issuer!: string;

  @ApiProperty({
    description:
      'Authorization endpoint for initiating OAuth 2.0 authorization code flows',
    example:
      'https://auth.example.com/api/v1/authorize/mcp/inventory/v1',
  })
  authorization_endpoint!: string;

  @ApiProperty({
    description: 'Token endpoint for exchanging OAuth 2.0 authorization codes',
    example: 'https://auth.example.com/api/v1/token/mcp/inventory/v1',
  })
  token_endpoint!: string;

  @ApiProperty({
    description: 'Dynamic client registration endpoint for MCP integrations',
    example: 'https://auth.example.com/api/v1/register/mcp/inventory/v1',
  })
  registration_endpoint!: string;

  @ApiProperty({
    description: 'Scopes supported by this MCP authorization server',
    example: ['mcp.read', 'mcp.write', 'openid', 'offline_access'],
    type: [String],
  })
  scopes_supported!: string[];

  @ApiProperty({
    description:
      'OAuth 2.0 response types supported by this authorization server',
    example: ['code'],
    type: [String],
  })
  response_types_supported!: string[];

  @ApiProperty({
    description: 'OAuth 2.0 grant types supported by this authorization server',
    example: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
    enum: GrantType,
    isArray: true,
  })
  grant_types_supported!: GrantType[];

  @ApiProperty({
    description:
      'Client authentication methods supported by the token endpoint',
    example: ['client_secret_basic', 'private_key_jwt'],
    type: [String],
  })
  token_endpoint_auth_methods_supported!: string[];

  @ApiProperty({
    description:
      'PKCE code challenge methods supported by this authorization server',
    example: ['S256'],
    type: [String],
  })
  code_challenge_methods_supported!: string[];
}