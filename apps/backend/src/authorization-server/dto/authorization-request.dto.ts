import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResponseType } from '../enums';

/**
 * OAuth 2.0 Authorization Request DTO
 * Based on RFC 6749 Section 4.1.1 and RFC 7636 (PKCE)
 */
export class AuthorizationRequestDto {
  @ApiProperty({
    description: 'OAuth 2.0 response type (must be "code" for authorization code flow)',
    example: 'code',
    enum: ResponseType,
  })
  @IsEnum(ResponseType)
  response_type!: ResponseType;

  @ApiPropertyOptional({
    description: 'Comma separated list of scopes'
  })
  @IsString()
  scope?: string;

  @ApiProperty({
    description: 'Client identifier issued during registration',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiProperty({
    description: 'PKCE code challenge derived from the code verifier',
    example: 'SVDkCojJ1edZzG47VFce6y2o5ieCQG19ueoYMQ_xloo',
  })
  @IsString()
  @IsNotEmpty()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code_challenge!: string;

  @ApiProperty({
    description: 'PKCE code challenge method (S256 for SHA-256)',
    example: 'S256',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^S256$/)
  code_challenge_method!: string;

  @ApiProperty({
    description: 'Redirect URI where the authorization response will be sent',
    example: 'http://localhost:6274/oauth/callback/debug',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true })
  redirect_uri!: string;

  @ApiProperty({
    description: 'Opaque state value for CSRF protection',
    example: 'c5d4fa797d8c0a9025237aafb780ef7e9c38a721a00530372bc26c89572b1833',
  })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({
    description: 'Resource server URL that the client wants to access',
    example: 'http://localhost:4001/',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true })
  resource!: string;
}
