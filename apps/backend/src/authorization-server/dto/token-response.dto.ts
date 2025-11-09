import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenType } from '../enums';

/**
 * Standard OAuth 2.0 token response DTO.
 * Mirrors RFC 6749 Section 5.1 for bearer tokens.
 */
export class TokenResponseDto {
  @ApiProperty({
    description: 'Opaque access token used to access protected resources',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token!: string;

  @ApiProperty({
    description: 'Type of token issued (MCP clients always receive Bearer tokens)',
    enum: TokenType,
    example: TokenType.BEARER,
    default: TokenType.BEARER,
  })
  token_type: TokenType = TokenType.BEARER;

  @ApiProperty({
    description: 'Lifetime of the access token in seconds',
    example: 3600,
  })
  expires_in!: number;

  @ApiProperty({
    description: 'Refresh token that can be exchanged for a new access token',
    example: 'def5020091c58c49fbb...',
  })
  refresh_token!: string;

  @ApiPropertyOptional({
    description: 'Space-delimited scopes that were granted for this token',
    example: 'tasks:read tasks:write',
  })
  scope?: string;
}
