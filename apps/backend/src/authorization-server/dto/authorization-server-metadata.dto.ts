import { ApiProperty } from '@nestjs/swagger';
import { GrantType } from '../enums';

export class AuthorizationServerMetadataDto {
  @ApiProperty({
    description: 'Issuer identifier for the MCP authorization server',
    example: 'https://api.example.com/v1/mcp-server',
  })
  issuer!: string;

  @ApiProperty({
    description: 'Authorization endpoint for initiating OAuth 2.0 authorization code flows',
    example: 'https://api.example.com/v1/authorize/mcp-server',
  })
  authorization_endpoint!: string;

  @ApiProperty({
    description: 'Dynamic client registration endpoint for MCP integrations',
    example: 'https://api.example.com/v1/register/mcp-server',
  })
  registration_endpoint!: string;

  @ApiProperty({
    description: 'Scopes supported by this MCP authorization server',
    example: ['mcp:tool.read', 'mcp:tool.write'],
    type: [String],
  })
  scopes_supported!: string[];

  @ApiProperty({
    description: 'OAuth 2.0 response types supported by this authorization server',
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
    description: 'Client authentication methods supported by the token endpoint',
    example: ['client_secret_post'],
    type: [String],
  })
  token_endpoint_auth_methods_supported!: string[];

  @ApiProperty({
    description: 'PKCE code challenge methods supported by this authorization server',
    example: ['S256'],
    type: [String],
  })
  code_challenge_methods_supported!: string[];
}
