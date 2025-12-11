import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth 2.0 Token Exchange response DTO (RFC 8693).
 * Contains the newly issued access token and its metadata.
 */
export class TokenExchangeResponseDto {
  @ApiProperty({
    description: 'The newly issued access token after successful exchange',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token!: string;

  @ApiProperty({
    description: 'Type identifier for the issued token as defined in RFC 8693',
    example: 'urn:ietf:params:oauth:token-type:access_token',
  })
  issued_token_type!: string;

  @ApiProperty({
    description: 'Type of token issued, always Bearer for MCP clients',
    example: 'Bearer',
  })
  token_type!: string;

  @ApiProperty({
    description: 'Lifetime of the access token in seconds',
    example: 3600,
  })
  expires_in!: number;

  @ApiProperty({
    description: 'Space-delimited list of scopes granted for the exchanged token',
    example: 'tasks:read tasks:write',
  })
  scope!: string;

  constructor(
    accessToken: string,
    issuedTokenType: string,
    tokenType: string,
    expiresIn: number,
    scope: string,
  ) {
    this.access_token = accessToken;
    this.issued_token_type = issuedTokenType;
    this.token_type = tokenType;
    this.expires_in = expiresIn;
    this.scope = scope;
  }
}
