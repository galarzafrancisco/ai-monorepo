import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GithubAuthType } from '../../enums';

export class CreateGithubConnectionDto {
  @ApiProperty({ description: 'Display name', example: 'Acme GitHub' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: GithubAuthType, enumName: 'GithubAuthType', example: GithubAuthType.PAT })
  @IsEnum(GithubAuthType)
  authType!: GithubAuthType;

  @ApiProperty({
    description:
      'The personal access token (PAT), or the whole PEM private key of the GitHub App (App). Stored encrypted and never returned.',
    example: 'github_pat_...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16384)
  secret!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'GitHub App id. Required for App connections.', example: '123456' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  appId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'GitHub App installation id. Required for App connections.',
    example: '7890123',
  })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  installationId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repository owners (users or organisations) this connection is used for. Empty: the account the credential acts as.',
    example: ['acme'],
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  owners?: string[];
}
