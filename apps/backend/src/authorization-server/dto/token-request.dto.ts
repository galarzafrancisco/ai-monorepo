import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GrantType } from '../enums';

/**
 * OAuth 2.0 token request DTO.
 * Covers both authorization_code (with PKCE) and refresh_token grants.
 */
export class TokenRequestDto {
  @ApiProperty({
    description: 'Grant type that determines which parameters must be supplied',
    enum: GrantType,
    example: GrantType.AUTHORIZATION_CODE,
  })
  @IsEnum(GrantType)
  grant_type!: GrantType;

  @ApiProperty({
    description: 'Client identifier issued during dynamic registration',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiPropertyOptional({
    description: 'Authorization code that was issued by the /authorize endpoint',
    example: 'SplxlOBeZQQYbYS6WxSbIA',
  })
  @ValidateIf((dto) => dto.grant_type === GrantType.AUTHORIZATION_CODE)
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({
    description: 'Redirect URI used during authorization (required when code is present)',
    example: 'http://localhost:6274/oauth/callback/debug',
  })
  @ValidateIf((dto) => dto.grant_type === GrantType.AUTHORIZATION_CODE)
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  redirect_uri?: string;

  @ApiPropertyOptional({
    description: 'PKCE code verifier used to validate the authorization code exchange',
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
    description: 'Optional list of scopes to narrow when refreshing a token (space-delimited)',
    example: 'tasks:read tasks:write',
  })
  @IsOptional()
  @IsString()
  scope?: string;
}
