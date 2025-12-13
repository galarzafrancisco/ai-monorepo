import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsUrl,
  ArrayMinSize,
  ArrayNotEmpty,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GrantType, ResponseType, TokenEndpointAuthMethod } from '../enums';

// - redirect_uris: string[] ✅
// - token_endpoint_auth_method: 'none' ✅
// - grant_types: ['authorization_code', 'refresh_token'] ✅
// - response_types: ['code'] ✅
// - client_name: string ✅
// OPTIONAL
// - scope?: string ✅
// - contacts?: string[] ✅
// - tos_uri?: string[]
// - client_uri?: string
// - logo_uri?: string
// - policy_uri?: string
// - jwks_uri?: string
// - jwks? 
// - software_id?
// - software_version?

export class RegisterClientDto {
  @ApiProperty({
    description: 'Array of redirect URIs for authorization callbacks (supports http and localhost for MCP clients)',
    example: ['http://localhost:3000/callback', 'https://example.com/callback'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true }, { each: true })
  redirect_uris!: string[]; // ✅

  @ApiProperty({
    description: 'Authentication method for the token endpoint (MCP clients use "none")',
    example: TokenEndpointAuthMethod.NONE,
    enum: TokenEndpointAuthMethod,
  })
  @IsEnum(TokenEndpointAuthMethod)
  token_endpoint_auth_method!: TokenEndpointAuthMethod; // ✅

  @ApiProperty({
    description:
      'Grant types the client will use. Must include authorization_code and refresh_token per MCP requirements.',
    example: ['authorization_code', 'refresh_token'],
    enum: GrantType,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(GrantType, { each: true })
  grant_types!: GrantType[]; // ✅

  @ApiProperty({
    description: 'Array of the OAuth 2.0 response type strings that the client can use at the authorization endpoint.',
    example: [ResponseType.CODE],
    enum: ResponseType,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ResponseType, { each: true })
  response_types!: ResponseType[]; // ✅

  @ApiProperty({
    description: 'Human-readable name of the client',
    example: 'My OAuth Client',
  })
  @IsString()
  @IsNotEmpty()
  client_name!: string; // ✅

  /*
   * Optional fields
  */

  @ApiPropertyOptional({
    description: 'Requested scopes for the client',
    example: ['data:read', 'data:write'],
    type: [String],
  })
  @IsString()
  @IsOptional()
  scope?: string; // ✅

  @ApiPropertyOptional({
    description: 'Contact emails for the client registration',
    example: ['admin@example.com'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contacts?: string[];  // ✅

  @ApiPropertyOptional({
    description: 'Terms of service URI for the client registration',
    example: 'https://example.com/tos',
  })
  @IsUrl()
  @IsOptional()
  tos_uri?: string;

  @ApiPropertyOptional({
    description: 'URL of the home page of the client',
    example: 'https://example.com',
  })
  @IsUrl()
  @IsOptional()
  client_uri?: string;

  @ApiPropertyOptional({
    description: 'URL that references a logo for the client application',
    example: 'https://example.com/logo.png',
  })
  @IsUrl()
  @IsOptional()
  logo_uri?: string;

  @ApiPropertyOptional({
    description: 'URL that the client provides to the end-user to read about how the profile data will be used',
    example: 'https://example.com/privacy',
  })
  @IsUrl()
  @IsOptional()
  policy_uri?: string;

  @ApiPropertyOptional({
    description: 'URL for the client JSON Web Key Set document. If specified, must not include jwks parameter',
    example: 'https://example.com/.well-known/jwks.json',
  })
  @IsUrl()
  @IsOptional()
  jwks_uri?: string;

  @ApiPropertyOptional({
    description: 'Client JSON Web Key Set document value as a JSON string. If specified, must not include jwks_uri parameter',
    example: '{"keys":[{"kty":"RSA","use":"sig","kid":"key-1","n":"...","e":"AQAB"}]}',
  })
  @IsString()
  @IsOptional()
  jwks?: string;

  @ApiPropertyOptional({
    description: 'Unique identifier string assigned by the client developer or software publisher',
    example: 'my-oauth-app-v1',
  })
  @IsString()
  @IsOptional()
  software_id?: string;

  @ApiPropertyOptional({
    description: 'Version identifier string for the client software',
    example: '1.0.0',
  })
  @IsString()
  @IsOptional()
  software_version?: string;

}
