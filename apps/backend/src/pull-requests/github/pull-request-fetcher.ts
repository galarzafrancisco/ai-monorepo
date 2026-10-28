import { GithubApi, githubRequest } from '../../integrations/github/github-api';
import { PullRequestEtags } from '../pull-request.entity';
import { PullRequestState } from '../enums';
import { PullRequestRef } from './pull-request-ref';
import {
  checkRunOutcome,
  commitStatusOutcome,
  PullRequestSnapshot,
  summarizeChecks,
  summarizeReviews,
} from './pull-request-snapshot';

type GithubPull = {
  title: string;
  state: 'open' | 'closed';
  draft?: boolean;
  merged: boolean;
  merged_at: string | null;
  closed_at: string | null;
  updated_at: string;
  user: { login: string } | null;
  head: { sha: string; ref: string };
  base: { ref: string; repo: { name: string; owner: { login: string } } };
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number;
  review_comments: number;
};

type GithubCheckRuns = { check_runs: Array<{ name: string; status: string; conclusion: string | null }> };
type GithubCombinedStatus = { statuses: Array<{ context: string; state: string }> };
type GithubReview = { user: { login: string } | null; state: string };

/** Parts of the last snapshot reused when GitHub answers 304 Not Modified. */
export type PreviousPullRequest = { [K in keyof PullRequestSnapshot]?: PullRequestSnapshot[K] | null } | null;

export type FetchedPullRequest = {
  snapshot: PullRequestSnapshot;
  etags: PullRequestEtags;
};

/**
 * Reads a pull request, its reviews and the CI of its latest commit: four
 * conditional requests. Answers of 304 (unchanged, and free of rate limit)
 * reuse the previous values.
 */
export async function fetchPullRequest(
  api: GithubApi,
  ref: PullRequestRef,
  etags: PullRequestEtags,
  previous: PreviousPullRequest,
): Promise<FetchedPullRequest> {
  const base = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  const hasPrevious = previous?.headSha != null;

  const pull = await githubRequest<GithubPull>(api, `${base}/pulls/${ref.number}`, {
    etag: hasPrevious ? etags.pull : null,
  });
  const nextEtags: PullRequestEtags = { pull: pull.etag ?? undefined };

  let pullPart: Omit<
    PullRequestSnapshot,
    'checksStatus' | 'checksTotal' | 'checksPassed' | 'checksFailed' | 'checksPending' | 'failedChecks' | 'reviewDecision' | 'approvals'
  >;
  if (pull.data) {
    const data = pull.data;
    pullPart = {
      owner: data.base.repo.owner.login,
      repo: data.base.repo.name,
      title: data.title,
      state: data.merged ? PullRequestState.MERGED : data.state === 'closed' ? PullRequestState.CLOSED : PullRequestState.OPEN,
      draft: data.draft ?? false,
      authorLogin: data.user?.login ?? null,
      headSha: data.head.sha,
      headRef: data.head.ref,
      baseRef: data.base.ref,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
      commentCount: data.comments + data.review_comments,
      mergedAt: data.merged_at ? new Date(data.merged_at) : null,
      closedAt: data.closed_at ? new Date(data.closed_at) : null,
      githubUpdatedAt: new Date(data.updated_at),
    };
  } else {
    pullPart = previous as PullRequestSnapshot;
  }

  const sameSha = hasPrevious && etags.sha === pullPart.headSha;
  const commit = `${base}/commits/${encodeURIComponent(pullPart.headSha)}`;
  const [checkRuns, statuses, reviews] = await Promise.all([
    githubRequest<GithubCheckRuns>(api, `${commit}/check-runs?per_page=100`, {
      etag: sameSha ? etags.checkRuns : null,
    }),
    githubRequest<GithubCombinedStatus>(api, `${commit}/status?per_page=100`, {
      etag: sameSha ? etags.statuses : null,
    }),
    githubRequest<GithubReview[]>(api, `${base}/pulls/${ref.number}/reviews?per_page=100`, {
      etag: hasPrevious ? etags.reviews : null,
    }),
  ]);
  nextEtags.sha = pullPart.headSha;
  nextEtags.checkRuns = checkRuns.etag ?? undefined;
  nextEtags.statuses = statuses.etag ?? undefined;
  nextEtags.reviews = reviews.etag ?? undefined;

  // Check runs and statuses are summarized together, so both lists are needed
  // whenever either changed: read the unchanged one again without its tag.
  let runs = checkRuns.data;
  let commitStatuses = statuses.data;
  if (runs && !commitStatuses) {
    const again = await githubRequest<GithubCombinedStatus>(api, `${commit}/status?per_page=100`);
    commitStatuses = again.data;
    nextEtags.statuses = again.etag ?? undefined;
  } else if (!runs && commitStatuses) {
    const again = await githubRequest<GithubCheckRuns>(api, `${commit}/check-runs?per_page=100`);
    runs = again.data;
    nextEtags.checkRuns = again.etag ?? undefined;
  }

  const checksPart =
    runs && commitStatuses
      ? summarizeChecks([
          ...runs.check_runs.map((run) => ({ name: run.name, outcome: checkRunOutcome(run) })),
          ...commitStatuses.statuses.map((status) => ({ name: status.context, outcome: commitStatusOutcome(status.state) })),
        ])
      : {
          checksStatus: previous!.checksStatus!,
          checksTotal: previous!.checksTotal!,
          checksPassed: previous!.checksPassed!,
          checksFailed: previous!.checksFailed!,
          checksPending: previous!.checksPending!,
          failedChecks: previous!.failedChecks!,
        };

  const reviewsPart = reviews.data
    ? summarizeReviews(reviews.data)
    : { reviewDecision: previous!.reviewDecision!, approvals: previous!.approvals! };

  return { snapshot: { ...pullPart, ...checksPart, ...reviewsPart }, etags: nextEtags };
}
