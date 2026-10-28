import { IssueEntity } from '../../issue.entity';
import { issueUrl } from '../../github/issue-ref';
import { IssueResponseDto } from './issue-response.dto';

export function toIssueResponse(row: IssueEntity): IssueResponseDto {
  return {
    id: row.id,
    key: row.key,
    host: row.host,
    owner: row.owner,
    repo: row.repo,
    number: row.number,
    url: issueUrl(row),
    title: row.title,
    state: row.state,
    stateReason: row.stateReason,
    isPullRequest: row.isPullRequest,
    authorLogin: row.authorLogin,
    labels: row.labels.map((label) => ({ name: label.name, color: label.color })),
    assignees: row.assignees,
    milestone: row.milestone,
    commentCount: row.commentCount,
    closedAt: row.closedAt?.toISOString() ?? null,
    githubUpdatedAt: row.githubUpdatedAt?.toISOString() ?? null,
    lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}
