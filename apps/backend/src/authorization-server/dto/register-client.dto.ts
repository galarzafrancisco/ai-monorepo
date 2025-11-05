import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsUrl,
  ArrayMinSize,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GrantType, TokenEndpointAuthMethod } from '../enums';

export class RegisterClientDto {
  @ApiProperty({
    description: 'Human-readable name of the client',
    example: 'My OAuth Client',
  })
  @IsString()
  @IsNotEmpty()
  client_name!: string;

  @ApiProperty({
    description: 'Array of redirect URIs for authorization callbacks (supports http and localhost for MCP clients)',
    example: ['http://localhost:3000/callback', 'https://example.com/callback'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true }, { each: true })
  redirect_uris!: string[];

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
  grant_types!: GrantType[];

  @ApiProperty({
    description: 'Authentication method for the token endpoint (MCP clients use "none")',
    example: TokenEndpointAuthMethod.NONE,
    enum: TokenEndpointAuthMethod,
  })
  @IsEnum(TokenEndpointAuthMethod)
  token_endpoint_auth_method!: TokenEndpointAuthMethod;

  @ApiPropertyOptional({
    description: 'Requested scopes for the client',
    example: ['openid', 'profile', 'email'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scope?: string[];

  @ApiPropertyOptional({
    description: 'Contact emails for the client registration',
    example: ['admin@example.com'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contacts?: string[];

  @ApiPropertyOptional({
    description:
      'PKCE code challenge method. Must be S256 for authorization_code grant.',
    example: 'S256',
  })
  @IsString()
  @IsOptional()
  code_challenge_method?: string;
}
