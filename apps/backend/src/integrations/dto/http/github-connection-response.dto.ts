import { ApiProperty } from '@nestjs/swagger';
import { GithubAuthType } from '../../enums';

export class GithubConnectionResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'Acme GitHub' })
  name!: string;

  @ApiProperty({ enum: GithubAuthType, enumName: 'GithubAuthType', example: GithubAuthType.PAT })
  authType!: GithubAuthType;

  @ApiProperty({ type: String, nullable: true, example: '123456' })
  appId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '7890123' })
  installationId!: string | null;

  @ApiProperty({ type: [String], description: 'Repository owners this connection is used for', example: ['acme'] })
  owners!: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Who GitHub says the connection acts as',
    example: 'octocat',
  })
  accountLogin!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-01-01T00:00:00.000Z' })
  lastVerifiedAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the last check with GitHub failed; null when it worked',
    example: null,
  })
  lastError!: string | null;

  @ApiProperty({ example: 1 })
  rowVersion!: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}
