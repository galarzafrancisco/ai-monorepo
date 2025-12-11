import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, MaxLength, IsOptional, Matches } from 'class-validator';

export class CreateConnectionDto {
  @ApiProperty({
    description: 'Friendly name to identify this OAuth connection',
    example: 'GitHub OAuth Connection',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  friendlyName!: string;

  @ApiProperty({
    description: 'Unique identifier for this connection (alphanumeric, dash, underscore only). Used for token exchange.',
    example: 'google-oauth',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'providedId must contain only alphanumeric characters, dashes, and underscores',
  })
  providedId?: string;

  @ApiProperty({
    description: 'OAuth client ID for the downstream provider',
    example: 'github_client_abc123',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  clientId!: string;

  @ApiProperty({
    description: 'OAuth client secret for the downstream provider',
    example: 'secret_xyz789',
  })
  @IsString()
  @IsNotEmpty()
  clientSecret!: string;

  @ApiProperty({
    description: 'OAuth authorization endpoint URL',
    example: 'https://github.com/login/oauth/authorize',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  authorizeUrl!: string;

  @ApiProperty({
    description: 'OAuth token endpoint URL',
    example: 'https://github.com/login/oauth/access_token',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  tokenUrl!: string;
}
