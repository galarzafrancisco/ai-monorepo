import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGithubConnectionDto {
  @ApiPropertyOptional({ description: 'Display name', example: 'Acme GitHub' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'The address of the GitHub to connect to. Changing it checks the credential again.',
    example: 'https://github.acme.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional({
    description: 'A new token or private key. Leave out to keep the current one.',
    example: 'github_pat_...',
  })
  @IsString()
  @MaxLength(16384)
  @IsOptional()
  secret?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'GitHub App id', example: '123456' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  appId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'GitHub App installation id', example: '7890123' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  installationId?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Repository owners this connection is used for', example: ['acme'] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  owners?: string[];
}
