import { ChecksStatus, PullRequestChange, PullRequestState, ReviewDecision } from '../enums';
import { PullRequestSnapshot } from './pull-request-snapshot';

type Comparable = Pick<
  PullRequestSnapshot,
  'state' | 'draft' | 'headSha' | 'checksStatus' | 'reviewDecision' | 'approvals' | 'commentCount'
>;

/**
 * What happened between two snapshots, in the order a person would tell it.
 * The first snapshot of a pull request has nothing to compare with: no changes.
 */
export function diffPullRequest(before: Comparable | null, after: Comparable): PullRequestChange[] {
  if (!before) return [];
  const changes: PullRequestChange[] = [];

  if (before.state !== after.state) {
    if (after.state === PullRequestState.MERGED) changes.push(PullRequestChange.MERGED);
    else if (after.state === PullRequestState.CLOSED) changes.push(PullRequestChange.CLOSED);
    else changes.push(PullRequestChange.REOPENED);
  }
  if (before.draft && !after.draft && after.state === PullRequestState.OPEN) {
    changes.push(PullRequestChange.READY_FOR_REVIEW);
  }
  if (!before.draft && after.draft) changes.push(PullRequestChange.CONVERTED_TO_DRAFT);
  if (before.headSha !== after.headSha) changes.push(PullRequestChange.NEW_COMMITS);

  // New commits restart CI, so a repeat of the same outcome on a new commit is news too.
  const checksMoved = before.checksStatus !== after.checksStatus || before.headSha !== after.headSha;
  if (checksMoved) {
    if (after.checksStatus === ChecksStatus.PENDING) changes.push(PullRequestChange.CHECKS_STARTED);
    if (after.checksStatus === ChecksStatus.SUCCESS) changes.push(PullRequestChange.CHECKS_PASSED);
    if (after.checksStatus === ChecksStatus.FAILURE) changes.push(PullRequestChange.CHECKS_FAILED);
  }

  if (
    after.reviewDecision === ReviewDecision.APPROVED &&
    (before.reviewDecision !== ReviewDecision.APPROVED || after.approvals > before.approvals)
  ) {
    changes.push(PullRequestChange.APPROVED);
  }
  if (after.reviewDecision === ReviewDecision.CHANGES_REQUESTED && before.reviewDecision !== ReviewDecision.CHANGES_REQUESTED) {
    changes.push(PullRequestChange.CHANGES_REQUESTED);
  }
  if ((after.commentCount ?? 0) > (before.commentCount ?? 0)) changes.push(PullRequestChange.NEW_COMMENTS);

  return changes;
}
