import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenType } from '../enums';
import { AccessTokenClaims } from '../../auth/core/types/access-token-claims.type';

/**
 * DTO for OAuth 2.0 token introspection responses (RFC 7662).
 * Mirrors the claims we issue in the JWT payload.
 *
 * Per RFC 7662, when active is false, other fields should not be present.
 * When active is true, all metadata fields are included.
 */
export class IntrospectTokenResponseDto {
  @ApiProperty({
    description: 'Indicates whether the token is currently valid',
    example: true,
  })
  active!: boolean;

  @ApiPropertyOptional({
    description: 'Token type, always Bearer for MCP clients. Only present when active is true.',
    enum: TokenType,
    example: TokenType.BEARER,
  })
  token_type?: TokenType;

  @ApiPropertyOptional({
    description: 'Client identifier associated with the token. Only present when active is true.',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  client_id?: string;

  @ApiPropertyOptional({
    description: 'Subject of the token (resource owner or actor). Only present when active is true.',
    example: 'journey:1234',
  })
  sub?: AccessTokenClaims['sub'];

  @ApiPropertyOptional({
    description: 'Audience that should accept this token. Only present when active is true.',
    oneOf: [
      { type: 'string', example: 'tasks-api' },
      { type: 'array', items: { type: 'string' }, example: ['tasks-api'] },
    ],
  })
  aud?: AccessTokenClaims['aud'];

  @ApiPropertyOptional({
    description: 'Issuer that minted the token. Only present when active is true.',
    example: 'https://auth.tasks.local/auth',
  })
  iss?: AccessTokenClaims['iss'];

  @ApiPropertyOptional({
    description: 'Unique token identifier for replay detection. Only present when active is true.',
    example: 'b15e8a76-5b6d-4bde-9a3b-26fdbaab5b4c',
  })
  jti?: AccessTokenClaims['jti'];

  @ApiPropertyOptional({
    description: 'Expiration timestamp (seconds since Unix epoch). Only present when active is true.',
    example: 1731145219,
  })
  exp?: AccessTokenClaims['exp'];

  @ApiPropertyOptional({
    description: 'Issued-at timestamp (seconds since Unix epoch). Only present when active is true.',
    example: 1731141619,
  })
  iat?: AccessTokenClaims['iat'];

  @ApiPropertyOptional({
    description: 'Granted scopes (space-delimited) for display purposes',
    example: 'tasks:read tasks:write',
  })
  scope?: string;

  @ApiPropertyOptional({
    description: 'MCP server identifier the token is scoped to',
    example: 'tasks',
  })
  mcp_server_identifier?: AccessTokenClaims['mcp_server_identifier'];

  @ApiPropertyOptional({
    description: 'Resource URL that was used during authorization. Only present when active is true.',
    example: 'http://localhost:4001/',
  })
  resource?: AccessTokenClaims['resource'];

  @ApiPropertyOptional({
    description: 'Version of the MCP server contract. Only present when active is true.',
    example: '1.0.0',
  })
  version?: AccessTokenClaims['version'];
}
