import { PullRequestChange } from '../../pull-requests/enums';

/** What a thread can wait for on a pull request. */
export const PULL_REQUEST_WATCH_CONDITIONS = [
  'checks_finished',
  'checks_failed',
  'checks_passed',
  'approved',
  'changes_requested',
  'new_comments',
  'new_commits',
  'ready_for_review',
  'merged',
  'closed',
] as const;

export type PullRequestWatchCondition = (typeof PULL_REQUEST_WATCH_CONDITIONS)[number];

/** Which changes satisfy each condition. Merging or closing always ends a watch, whatever it waits for. */
const MATCHES: Record<PullRequestWatchCondition, PullRequestChange[]> = {
  checks_finished: [PullRequestChange.CHECKS_PASSED, PullRequestChange.CHECKS_FAILED],
  checks_failed: [PullRequestChange.CHECKS_FAILED],
  checks_passed: [PullRequestChange.CHECKS_PASSED],
  approved: [PullRequestChange.APPROVED],
  changes_requested: [PullRequestChange.CHANGES_REQUESTED],
  new_comments: [PullRequestChange.NEW_COMMENTS],
  new_commits: [PullRequestChange.NEW_COMMITS],
  ready_for_review: [PullRequestChange.READY_FOR_REVIEW],
  merged: [PullRequestChange.MERGED],
  closed: [PullRequestChange.CLOSED],
};

const FINISHING: PullRequestChange[] = [PullRequestChange.MERGED, PullRequestChange.CLOSED];

/**
 * The changes a watch should hear about. Merged and closed are always
 * included: the pull request cannot change any more, so the watch ends.
 */
export function relevantChanges(conditions: string[], changes: PullRequestChange[]): PullRequestChange[] {
  const wanted = new Set<PullRequestChange>(FINISHING);
  for (const condition of conditions) {
    for (const change of MATCHES[condition as PullRequestWatchCondition] ?? []) wanted.add(change);
  }
  return changes.filter((change) => wanted.has(change));
}

export function isFinishing(changes: PullRequestChange[]): boolean {
  return changes.some((change) => FINISHING.includes(change));
}
