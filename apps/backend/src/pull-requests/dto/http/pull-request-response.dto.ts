import { ApiProperty } from '@nestjs/swagger';
import { ChecksStatus, PullRequestState, ReviewDecision } from '../../enums';

export class PullRequestResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ description: 'owner/repo#number, lower case', example: 'acme/api#12' })
  key!: string;

  @ApiProperty({ example: 'acme' })
  owner!: string;

  @ApiProperty({ example: 'api' })
  repo!: string;

  @ApiProperty({ example: 12 })
  number!: number;

  @ApiProperty({ example: 'https://github.com/acme/api/pull/12' })
  url!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Null until Taico has read the pull request', example: 'Add search' })
  title!: string | null;

  @ApiProperty({ enum: PullRequestState, enumName: 'PullRequestState', nullable: true, description: 'Null until Taico has read the pull request' })
  state!: PullRequestState | null;

  @ApiProperty({ example: false })
  draft!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'octocat' })
  authorLogin!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'feature/search' })
  headRef!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'main' })
  baseRef!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 123 })
  additions!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 32 })
  deletions!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 4 })
  changedFiles!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Conversation and review comments', example: 3 })
  commentCount!: number | null;

  @ApiProperty({ enum: ChecksStatus, enumName: 'ChecksStatus', description: 'CI of the latest commit' })
  checksStatus!: ChecksStatus;

  @ApiProperty({ example: 5 })
  checksTotal!: number;

  @ApiProperty({ example: 3 })
  checksPassed!: number;

  @ApiProperty({ example: 1 })
  checksFailed!: number;

  @ApiProperty({ example: 1 })
  checksPending!: number;

  @ApiProperty({ type: [String], description: 'Names of the failing checks', example: ['build'] })
  failedChecks!: string[];

  @ApiProperty({ enum: ReviewDecision, enumName: 'ReviewDecision' })
  reviewDecision!: ReviewDecision;

  @ApiProperty({ description: 'Reviewers whose latest review approves', example: 1 })
  approvals!: number;

  @ApiProperty({ type: String, nullable: true, example: null })
  mergedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  closedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'When GitHub says it last changed', example: null })
  githubUpdatedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'When Taico last read it from GitHub', example: null })
  lastFetchedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Why the last read failed; null when it worked', example: null })
  lastError!: string | null;
}
