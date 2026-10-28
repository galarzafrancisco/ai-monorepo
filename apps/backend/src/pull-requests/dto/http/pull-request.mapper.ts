import { PullRequestEntity } from '../../pull-request.entity';
import { pullRequestUrl } from '../../github/pull-request-ref';
import { PullRequestResponseDto } from './pull-request-response.dto';

export function toPullRequestResponse(row: PullRequestEntity): PullRequestResponseDto {
  return {
    id: row.id,
    key: row.key,
    host: row.host,
    owner: row.owner,
    repo: row.repo,
    number: row.number,
    url: pullRequestUrl(row),
    title: row.title,
    state: row.state,
    draft: row.draft,
    authorLogin: row.authorLogin,
    headRef: row.headRef,
    baseRef: row.baseRef,
    additions: row.additions,
    deletions: row.deletions,
    changedFiles: row.changedFiles,
    commentCount: row.commentCount,
    checksStatus: row.checksStatus,
    checksTotal: row.checksTotal,
    checksPassed: row.checksPassed,
    checksFailed: row.checksFailed,
    checksPending: row.checksPending,
    failedChecks: row.failedChecks,
    reviewDecision: row.reviewDecision,
    approvals: row.approvals,
    mergedAt: row.mergedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    githubUpdatedAt: row.githubUpdatedAt?.toISOString() ?? null,
    lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}
