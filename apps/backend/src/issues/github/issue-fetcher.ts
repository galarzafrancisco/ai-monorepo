import { GithubApi, githubRequest } from '../../integrations/github/github-api';
import { IssueEtags } from '../issue.entity';
import { IssueState } from '../enums';
import { IssueRef } from './issue-ref';
import { IssueSnapshot, toLabels, toStateReason } from './issue-snapshot';

type GithubIssue = {
  title: string;
  state: 'open' | 'closed';
  state_reason?: string | null;
  user: { login: string } | null;
  labels?: Array<string | { name?: string; color?: string | null }>;
  assignees?: Array<{ login: string }> | null;
  milestone?: { title: string } | null;
  comments: number;
  closed_at: string | null;
  updated_at: string;
  pull_request?: unknown;
};

export type FetchedIssue = {
  /** Null when GitHub answered 304 Not Modified: nothing changed. */
  snapshot: IssueSnapshot | null;
  etags: IssueEtags;
};

/** One conditional request. A 304 (unchanged, and free of rate limit) answers with no snapshot. */
export async function fetchIssue(api: GithubApi, ref: IssueRef, etags: IssueEtags, hasPrevious: boolean): Promise<FetchedIssue> {
  const path = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`;
  const response = await githubRequest<GithubIssue>(api, path, { etag: hasPrevious ? etags.issue : null });
  const nextEtags: IssueEtags = { issue: response.etag ?? undefined };
  if (!response.data) return { snapshot: null, etags: nextEtags };

  // A transferred issue answers from its new repository, maybe under a new
  // number: GitHub redirects the old address, so the link's own owner, repo
  // and number stay the ones Taico reads and keys by.
  const data = response.data;
  return {
    snapshot: {
      owner: ref.owner,
      repo: ref.repo,
      title: data.title,
      state: data.state === 'closed' ? IssueState.CLOSED : IssueState.OPEN,
      stateReason: toStateReason(data.state_reason),
      isPullRequest: data.pull_request != null,
      authorLogin: data.user?.login ?? null,
      labels: toLabels(data.labels),
      assignees: (data.assignees ?? []).map((assignee) => assignee.login),
      milestone: data.milestone?.title ?? null,
      commentCount: data.comments,
      closedAt: data.closed_at ? new Date(data.closed_at) : null,
      githubUpdatedAt: new Date(data.updated_at),
    },
    etags: nextEtags,
  };
}
