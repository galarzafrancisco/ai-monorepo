import { ApiProperty } from '@nestjs/swagger';

export class WorkerGithubCredentialDto {
  @ApiProperty({ example: 'taico' })
  projectSlug!: string;

  @ApiProperty({ description: 'HTTPS clone URL the token works with', example: 'https://github.com/acme/api.git' })
  cloneUrl!: string;

  @ApiProperty({ example: 'acme' })
  owner!: string;

  @ApiProperty({ example: 'api' })
  repo!: string;

  @ApiProperty({ description: 'Token for git over HTTPS and the GitHub API. Never log or store it.', example: 'ghs_...' })
  token!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'When the token stops working; null for a personal access token',
    example: '2026-01-01T01:00:00.000Z',
  })
  expiresAt!: string | null;

  @ApiProperty({ enum: ['pat', 'app'], example: 'app' })
  authType!: 'pat' | 'app';
}

export class WorkerGithubCredentialsResponseDto {
  @ApiProperty({
    type: [WorkerGithubCredentialDto],
    description:
      "One per project of the task whose GitHub connection may be used by workers. Empty when none is: the worker then uses the machine's own credentials.",
  })
  credentials!: WorkerGithubCredentialDto[];
}
