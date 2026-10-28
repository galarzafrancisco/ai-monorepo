/**
 * Pull Request Wire Event Types for WebSocket Communication
 *
 * Contract between the backend pull requests gateway and frontend consumers.
 */

export const PullRequestWireEvents = {
  PULL_REQUEST_UPDATED: 'pull_request.updated',
} as const;

export type PullRequestWireEventName =
  (typeof PullRequestWireEvents)[keyof typeof PullRequestWireEvents];

/** Matches PullRequestResponseDto from the backend. */
export interface PullRequestWirePayload {
  id: string;
  key: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string | null;
  state: 'open' | 'closed' | 'merged' | null;
  draft: boolean;
  authorLogin: string | null;
  headRef: string | null;
  baseRef: string | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  commentCount: number | null;
  checksStatus: 'none' | 'pending' | 'success' | 'failure';
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksPending: number;
  failedChecks: string[];
  reviewDecision: 'none' | 'approved' | 'changes_requested';
  approvals: number;
  mergedAt: string | null;
  closedAt: string | null;
  githubUpdatedAt: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
}

/** Emitted to everyone subscribed to pull requests when Taico's copy of one changes. */
export interface PullRequestUpdatedWireEvent {
  pullRequest: PullRequestWirePayload;
  /** What happened since the last look, e.g. "merged", "checks_failed". Empty for display-only changes. */
  changes: string[];
  occurredAt: string;
}
