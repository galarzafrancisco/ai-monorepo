import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { GithubConnectionResponseDto } from './github-connection-response.dto';

export class ResolveGithubConnectionQueryDto {
  @ApiProperty({ description: 'Repository URL (web or clone URL)', example: 'https://github.com/acme/api' })
  @IsString()
  @MaxLength(2048)
  repoUrl!: string;

  @ApiPropertyOptional({
    description: 'The connection the project names, if any',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  connectionId?: string;
}

export class GithubRepositoryRefDto {
  @ApiProperty({ description: 'github.com, or the host of a GitHub Enterprise', example: 'github.com' })
  host!: string;

  @ApiProperty({ example: 'acme' })
  owner!: string;

  @ApiProperty({ example: 'api' })
  repo!: string;
}

export const GITHUB_CONNECTION_MATCHES = ['project', 'owner', 'only_connection'] as const;

export class ResolvedGithubConnectionResponseDto {
  @ApiProperty({
    type: GithubRepositoryRefDto,
    nullable: true,
    description: 'The repository, or null when the URL is not on github.com or a GitHub Enterprise Taico has a connection to',
  })
  repository!: GithubRepositoryRefDto | null;

  @ApiProperty({
    type: GithubConnectionResponseDto,
    nullable: true,
    description: 'The connection Taico would use, or null when none fits (public github.com repositories are then read anonymously)',
  })
  connection!: GithubConnectionResponseDto | null;

  @ApiProperty({
    enum: GITHUB_CONNECTION_MATCHES,
    enumName: 'GithubConnectionMatch',
    nullable: true,
    description:
      'Why: the project names it, it lists the repository owner, or it is the only connection',
  })
  match!: (typeof GITHUB_CONNECTION_MATCHES)[number] | null;
}
