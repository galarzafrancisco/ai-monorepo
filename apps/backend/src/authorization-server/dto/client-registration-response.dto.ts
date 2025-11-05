import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GrantType, TokenEndpointAuthMethod } from '../enums';

export class ClientRegistrationResponseDto {
  @ApiProperty({
    description: 'Unique client identifier',
    example: '8f7a9c2e-4b1d-4e6f-9a2b-3c4d5e6f7a8b',
  })
  client_id!: string;

  @ApiPropertyOptional({
    description: 'Client secret for confidential clients',
    example: 'ZXhhbXBsZV9zZWNyZXRfa2V5',
    nullable: true,
  })
  client_secret?: string | null;

  @ApiProperty({
    description: 'Human-readable name of the client',
    example: 'My OAuth Client',
  })
  client_name!: string;

  @ApiProperty({
    description: 'Array of redirect URIs for authorization callbacks (supports http and localhost for MCP clients)',
    example: ['http://localhost:3000/callback', 'https://example.com/callback'],
    type: [String],
  })
  redirect_uris!: string[];

  @ApiProperty({
    description: 'Grant types the client is authorized to use',
    example: ['authorization_code', 'refresh_token'],
    enum: GrantType,
    isArray: true,
  })
  grant_types!: GrantType[];

  @ApiProperty({
    description: 'Authentication method for the token endpoint (MCP clients use "none")',
    example: TokenEndpointAuthMethod.NONE,
    enum: TokenEndpointAuthMethod,
  })
  token_endpoint_auth_method!: TokenEndpointAuthMethod;

  @ApiPropertyOptional({
    description: 'Scopes granted to the client',
    example: ['openid', 'profile', 'email'],
    type: [String],
    nullable: true,
  })
  scope?: string[] | null;

  @ApiPropertyOptional({
    description: 'Contact emails for the client',
    example: ['admin@example.com'],
    type: [String],
    nullable: true,
  })
  contacts?: string[] | null;

  @ApiPropertyOptional({
    description: 'PKCE code challenge method',
    example: 'S256',
    nullable: true,
  })
  code_challenge_method?: string | null;

  @ApiProperty({
    description: 'Client registration timestamp (ISO 8601)',
    example: '2025-11-05T08:00:00.000Z',
  })
  client_id_issued_at!: string;
}
