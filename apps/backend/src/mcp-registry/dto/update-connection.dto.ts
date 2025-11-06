import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class UpdateConnectionDto {
  @ApiPropertyOptional({
    description: 'Friendly name to identify this OAuth connection',
    example: 'GitHub OAuth Connection',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  friendlyName?: string;

  @ApiPropertyOptional({
    description: 'OAuth client ID for the downstream provider',
    example: 'github_client_abc123',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  clientId?: string;

  @ApiPropertyOptional({
    description: 'OAuth client secret for the downstream provider',
    example: 'secret_xyz789',
  })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiPropertyOptional({
    description: 'OAuth authorization endpoint URL',
    example: 'https://github.com/login/oauth/authorize',
  })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  authorizeUrl?: string;

  @ApiPropertyOptional({
    description: 'OAuth token endpoint URL',
    example: 'https://github.com/login/oauth/access_token',
  })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  tokenUrl?: string;
}
