import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon,
} from 'lucide-react';
import type { PullRequest } from './api';

export type PullRequestLook = 'open' | 'draft' | 'merged' | 'closed' | 'unknown';

/** How a pull request is drawn: GitHub's icon and color for its state. */
export function pullRequestLook(pullRequest: PullRequest | null | undefined): PullRequestLook {
  if (!pullRequest?.state) return 'unknown';
  if (pullRequest.state === 'merged') return 'merged';
  if (pullRequest.state === 'closed') return 'closed';
  return pullRequest.draft ? 'draft' : 'open';
}

export const LOOK_ICON: Record<PullRequestLook, LucideIcon> = {
  open: GitPullRequest,
  draft: GitPullRequestDraft,
  merged: GitMerge,
  closed: GitPullRequestClosed,
  unknown: GitPullRequest,
};

export const LOOK_LABEL: Record<PullRequestLook, string> = {
  open: 'Open',
  draft: 'Draft',
  merged: 'Merged',
  closed: 'Closed',
  unknown: 'Pull request',
};

/** CI only matters while the pull request can still change. */
export function showsChecks(pullRequest: PullRequest): boolean {
  return pullRequest.state === 'open' && pullRequest.checksStatus !== 'none';
}

export function checksLabel(pullRequest: PullRequest): string {
  const { checksStatus, checksTotal, checksPassed, checksFailed, checksPending } = pullRequest;
  switch (checksStatus) {
    case 'failure':
      return `${checksFailed} of ${checksTotal} checks failed`;
    case 'pending':
      return `${checksPending} of ${checksTotal} checks running`;
    case 'success':
      return `All ${checksPassed} checks passed`;
    default:
      return 'No checks';
  }
}

export function reviewLabel(pullRequest: PullRequest): string {
  if (pullRequest.reviewDecision === 'changes_requested') return 'Changes requested';
  if (pullRequest.reviewDecision === 'approved') {
    return pullRequest.approvals === 1 ? 'Approved' : `Approved by ${pullRequest.approvals}`;
  }
  return 'No reviews yet';
}

/** A one-line summary for tooltips and screen readers. */
export function describePullRequest(pullRequest: PullRequest): string {
  const parts = [LOOK_LABEL[pullRequestLook(pullRequest)]];
  if (showsChecks(pullRequest)) parts.push(checksLabel(pullRequest));
  if (pullRequest.state === 'open' && pullRequest.reviewDecision !== 'none') parts.push(reviewLabel(pullRequest));
  return parts.join(', ');
}
