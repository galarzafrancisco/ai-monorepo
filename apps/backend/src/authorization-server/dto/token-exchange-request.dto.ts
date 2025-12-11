import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * OAuth 2.0 Token Exchange request DTO (RFC 8693).
 * Used to exchange an existing access token for a new one with different scope or audience.
 */
export class TokenExchangeRequestDto {
  @ApiProperty({
    description: 'Grant type for token exchange as defined in RFC 8693',
    enum: ['urn:ietf:params:oauth:grant-type:token-exchange'],
    example: 'urn:ietf:params:oauth:grant-type:token-exchange',
  })
  @IsEnum(['urn:ietf:params:oauth:grant-type:token-exchange'])
  grant_type!: 'urn:ietf:params:oauth:grant-type:token-exchange';

  @ApiProperty({
    description: 'The access token that represents the identity of the party on behalf of whom the request is being made',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  subject_token!: string;

  @ApiProperty({
    description: 'Type identifier for the subject_token as defined in RFC 8693',
    enum: ['urn:ietf:params:oauth:token-type:access_token'],
    example: 'urn:ietf:params:oauth:token-type:access_token',
  })
  @IsEnum(['urn:ietf:params:oauth:token-type:access_token'])
  subject_token_type!: 'urn:ietf:params:oauth:token-type:access_token';

  @ApiProperty({
    description: 'Resource server URL that the client wants to access with the exchanged token',
    example: 'http://localhost:4001/',
  })
  @IsString()
  resource!: string;

  @ApiPropertyOptional({
    description: 'Optional space-delimited list of scopes for the exchanged token',
    example: 'tasks:read tasks:write',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\w\s\-\.:/]+$/, {
    message: 'Scope must be a space-delimited list of valid scope strings',
  })
  scope?: string;
}
