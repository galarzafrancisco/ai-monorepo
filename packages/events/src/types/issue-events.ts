/**
 * Issue Wire Event Types for WebSocket Communication
 *
 * Contract between the backend issues gateway and frontend consumers.
 */

export const IssueWireEvents = {
  ISSUE_UPDATED: 'issue.updated',
} as const;

export type IssueWireEventName = (typeof IssueWireEvents)[keyof typeof IssueWireEvents];

/** Matches IssueResponseDto from the backend. */
export interface IssueWirePayload {
  id: string;
  key: string;
  host: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string | null;
  state: 'open' | 'closed' | null;
  stateReason: 'completed' | 'not_planned' | 'duplicate' | 'reopened' | null;
  isPullRequest: boolean;
  authorLogin: string | null;
  labels: Array<{ name: string; color: string | null }>;
  assignees: string[];
  milestone: string | null;
  commentCount: number | null;
  closedAt: string | null;
  githubUpdatedAt: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
}

/** Emitted to everyone subscribed to issues when Taico's copy of one changes. */
export interface IssueUpdatedWireEvent {
  issue: IssueWirePayload;
  /** What happened since the last look, e.g. "closed", "new_comments". Empty for display-only changes. */
  changes: string[];
  occurredAt: string;
}
