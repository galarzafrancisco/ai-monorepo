import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenType } from '../enums';
import { AccessTokenClaims } from '../../auth/core/types/access-token-claims.type';


/**
 * DTO for OAuth 2.0 token introspection responses (RFC 7662).
 * Mirrors the claims we issue in the JWT payload.
 */
export class IntrospectTokenResponseDto {
  @ApiProperty({
    description: 'Indicates whether the token is currently valid',
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description: 'Token type, always Bearer for MCP clients',
    enum: TokenType,
    example: TokenType.BEARER,
  })
  token_type!: TokenType;

  @ApiProperty({
    description: 'Client identifier associated with the token',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  client_id!: string;

  @ApiProperty({
    description: 'Subject of the token (resource owner or actor)',
    example: 'journey:1234',
  })
  sub!: AccessTokenClaims['sub'];

  @ApiProperty({
    description: 'Audience that should accept this token',
    oneOf: [
      { type: 'string', example: 'taskeroo-api' },
      { type: 'array', items: { type: 'string' }, example: ['taskeroo-api'] },
    ],
  })
  aud!: AccessTokenClaims['aud'];

  @ApiProperty({
    description: 'Issuer that minted the token',
    example: 'https://auth.taskeroo.local/auth',
  })
  iss!: AccessTokenClaims['iss'];

  @ApiProperty({
    description: 'Unique token identifier for replay detection',
    example: 'b15e8a76-5b6d-4bde-9a3b-26fdbaab5b4c',
  })
  jti!: AccessTokenClaims['jti'];

  @ApiProperty({
    description: 'Expiration timestamp (seconds since Unix epoch)',
    example: 1731145219,
  })
  exp!: AccessTokenClaims['exp'];

  @ApiProperty({
    description: 'Issued-at timestamp (seconds since Unix epoch)',
    example: 1731141619,
  })
  iat!: AccessTokenClaims['iat'];

  @ApiPropertyOptional({
    description: 'Granted scopes (space-delimited) for display purposes',
    example: 'tasks:read tasks:write',
  })
  scope?: string;

  @ApiProperty({
    description: 'MCP server identifier the token is scoped to',
    example: 'taskeroo',
  })
  mcp_server_identifier?: AccessTokenClaims['mcp_server_identifier'];

  @ApiProperty({
    description: 'Resource URL that was used during authorization',
    example: 'http://localhost:4001/',
  })
  resource!: AccessTokenClaims['resource'];

  @ApiProperty({
    description: 'Version of the MCP server contract',
    example: '1.0.0',
  })
  version!: AccessTokenClaims['version'];
}
