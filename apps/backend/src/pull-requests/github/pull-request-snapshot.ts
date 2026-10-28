import { ChecksStatus, PullRequestState, ReviewDecision } from '../enums';

/** What Taico knows about a pull request after one look at GitHub. */
export type PullRequestSnapshot = {
  owner: string;
  repo: string;
  title: string;
  state: PullRequestState;
  draft: boolean;
  authorLogin: string | null;
  headSha: string;
  headRef: string;
  baseRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commentCount: number;
  checksStatus: ChecksStatus;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksPending: number;
  failedChecks: string[];
  reviewDecision: ReviewDecision;
  approvals: number;
  mergedAt: Date | null;
  closedAt: Date | null;
  githubUpdatedAt: Date | null;
};

export type CheckOutcome = 'passed' | 'failed' | 'pending' | 'neutral';

/** A check run's outcome. Skipped and neutral runs count for nothing. */
export function checkRunOutcome(run: { status: string; conclusion: string | null }): CheckOutcome {
  if (run.status !== 'completed') return 'pending';
  switch (run.conclusion) {
    case 'success':
      return 'passed';
    case 'neutral':
    case 'skipped':
      return 'neutral';
    case null:
      return 'pending';
    default:
      // failure, cancelled, timed_out, action_required, stale, startup_failure
      return 'failed';
  }
}

/** A commit status's outcome. */
export function commitStatusOutcome(state: string): CheckOutcome {
  if (state === 'success') return 'passed';
  if (state === 'pending') return 'pending';
  return 'failed';
}

export function summarizeChecks(checks: Array<{ name: string; outcome: CheckOutcome }>): Pick<
  PullRequestSnapshot,
  'checksStatus' | 'checksTotal' | 'checksPassed' | 'checksFailed' | 'checksPending' | 'failedChecks'
> {
  const counted = checks.filter((check) => check.outcome !== 'neutral');
  const failed = counted.filter((check) => check.outcome === 'failed');
  const pending = counted.filter((check) => check.outcome === 'pending');
  const passed = counted.filter((check) => check.outcome === 'passed');
  const checksStatus =
    failed.length > 0
      ? ChecksStatus.FAILURE
      : pending.length > 0
        ? ChecksStatus.PENDING
        : passed.length > 0
          ? ChecksStatus.SUCCESS
          : ChecksStatus.NONE;
  return {
    checksStatus,
    checksTotal: counted.length,
    checksPassed: passed.length,
    checksFailed: failed.length,
    checksPending: pending.length,
    failedChecks: [...new Set(failed.map((check) => check.name))],
  };
}

/**
 * The latest review of each reviewer decides. Comments do not change a
 * reviewer's decision; a dismissed review clears it.
 */
export function summarizeReviews(
  reviews: Array<{ user: { login: string } | null; state: string }>,
): Pick<PullRequestSnapshot, 'reviewDecision' | 'approvals'> {
  const latest = new Map<string, string>();
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login) continue;
    if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED') latest.set(login, review.state);
    else if (review.state === 'DISMISSED') latest.delete(login);
  }
  const decisions = [...latest.values()];
  const approvals = decisions.filter((state) => state === 'APPROVED').length;
  const reviewDecision = decisions.includes('CHANGES_REQUESTED')
    ? ReviewDecision.CHANGES_REQUESTED
    : approvals > 0
      ? ReviewDecision.APPROVED
      : ReviewDecision.NONE;
  return { reviewDecision, approvals };
}
