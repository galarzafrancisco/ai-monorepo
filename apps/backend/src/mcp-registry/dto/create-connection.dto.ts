import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

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
