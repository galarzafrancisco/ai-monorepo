import { IgnoresUnknownProperties } from '../../http/app-validation.pipe';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GrantType } from '../enums';

/**
 * OAuth 2.0 token request DTO.
 * Covers both authorization_code (with PKCE) and refresh_token grants.
 */
@IgnoresUnknownProperties()
export class TokenRequestDto {
  @ApiProperty({
    description: 'Grant type that determines which parameters must be supplied',
    enum: GrantType,
    example: GrantType.AUTHORIZATION_CODE,
  })
  @IsEnum(GrantType)
  grant_type!: GrantType;

  @ApiPropertyOptional({
    description:
      'Client identifier: issued during dynamic registration, or the URL of the client metadata document. Required unless a client_assertion is sent',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  // A client that authenticates with a client_assertion is identified by it
  // and may leave client_id out (RFC 7521 section 4.2)
  @ValidateIf((dto) => !dto.client_assertion || dto.client_id !== undefined)
  @IsString()
  @IsNotEmpty()
  client_id?: string;

  @ApiPropertyOptional({
    description:
      'Type of the client assertion. Sent by clients that authenticate with private_key_jwt',
    example: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  })
  @IsOptional()
  @IsString()
  client_assertion_type?: string;

  @ApiPropertyOptional({
    description:
      'JWT signed with the client private key (RFC 7523). Sent by clients that authenticate with private_key_jwt',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  client_assertion?: string;

  @ApiPropertyOptional({
    description:
      'Authorization code that was issued by the /authorize endpoint',
    example: 'SplxlOBeZQQYbYS6WxSbIA',
  })
  @ValidateIf((dto) => dto.grant_type === GrantType.AUTHORIZATION_CODE)
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({
    description:
      'Redirect URI used during authorization (required when code is present)',
    example: 'http://localhost:6274/oauth/callback/debug',
  })
  @ValidateIf((dto) => dto.grant_type === GrantType.AUTHORIZATION_CODE)
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  redirect_uri?: string;

  @ApiPropertyOptional({
    description:
      'PKCE code verifier used to validate the authorization code exchange',
    example: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  })
  @ValidateIf((dto) => dto.grant_type === GrantType.AUTHORIZATION_CODE)
  @IsString()
  @IsNotEmpty()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9-._~]+$/)
  code_verifier?: string;

  @ApiPropertyOptional({
    description: 'Refresh token issued earlier by the authorization server',
    example: 'def5020091c58c49fbb...',
  })
  @ValidateIf((dto) => dto.grant_type === GrantType.REFRESH_TOKEN)
  @IsString()
  @IsNotEmpty()
  refresh_token?: string;

  @ApiPropertyOptional({
    description:
      'Optional list of scopes to narrow when refreshing a token (space-delimited)',
    example: 'tasks:read tasks:write',
  })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({
    description:
      'Optional resource indicator (RFC 8707) - identifies the target resource server',
    example: 'http://localhost:4001/',
  })
  @IsOptional()
  @IsString()
  resource?: string;
}
