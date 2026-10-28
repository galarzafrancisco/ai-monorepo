import { ApiProperty } from '@nestjs/swagger';
import { IssueState, IssueStateReason } from '../../enums';

export class IssueLabelResponseDto {
  @ApiProperty({ example: 'bug' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Hex color without #, as GitHub gives it', example: 'd73a4a' })
  color!: string | null;
}

export class IssueResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({
    description: 'owner/repo#number on github.com, host/owner/repo#number on a GitHub Enterprise; lower case',
    example: 'acme/api#12',
  })
  key!: string;

  @ApiProperty({ description: 'github.com, or the host of a GitHub Enterprise', example: 'github.com' })
  host!: string;

  @ApiProperty({ example: 'acme' })
  owner!: string;

  @ApiProperty({ example: 'api' })
  repo!: string;

  @ApiProperty({ example: 12 })
  number!: number;

  @ApiProperty({ example: 'https://github.com/acme/api/issues/12' })
  url!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Null until Taico has read the issue', example: 'Search is slow' })
  title!: string | null;

  @ApiProperty({ enum: IssueState, enumName: 'IssueState', nullable: true, description: 'Null until Taico has read the issue' })
  state!: IssueState | null;

  @ApiProperty({
    enum: IssueStateReason,
    enumName: 'IssueStateReason',
    nullable: true,
    description: 'Why it is closed (completed, not planned, duplicate), or reopened',
  })
  stateReason!: IssueStateReason | null;

  @ApiProperty({ description: 'The link is an /issues/ link to a pull request', example: false })
  isPullRequest!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'octocat' })
  authorLogin!: string | null;

  @ApiProperty({ type: [IssueLabelResponseDto] })
  labels!: IssueLabelResponseDto[];

  @ApiProperty({ type: [String], example: ['octocat'] })
  assignees!: string[];

  @ApiProperty({ type: String, nullable: true, example: 'v1.2' })
  milestone!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 3 })
  commentCount!: number | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  closedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'When GitHub says it last changed', example: null })
  githubUpdatedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'When Taico last read it from GitHub', example: null })
  lastFetchedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Why the last read failed; null when it worked', example: null })
  lastError!: string | null;
}
