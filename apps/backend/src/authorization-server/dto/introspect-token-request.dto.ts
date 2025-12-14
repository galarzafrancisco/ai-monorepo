import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenTypeHint } from '../enums';

/**
 * DTO for the OAuth 2.0 token introspection request body (RFC 7662).
 */
export class IntrospectTokenRequestDto {
  @ApiProperty({
    description: 'Access or refresh token that should be validated',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    description: 'Hint to help the server determine the token lookup strategy',
    enum: TokenTypeHint,
    example: TokenTypeHint.ACCESS_TOKEN,
  })
  @IsOptional()
  @IsEnum(TokenTypeHint)
  token_type_hint?: TokenTypeHint;

  @ApiPropertyOptional({
    description: 'Client identifier for optional validation against the token claims. Per RFC 7662, this is not required - the client_id is extracted from the token itself.',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  client_id?: string;

  @ApiPropertyOptional({
    description: 'Client secret for confidential clients (MCP clients typically omit this)',
    example: 's3cr3t',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  client_secret?: string;
}
