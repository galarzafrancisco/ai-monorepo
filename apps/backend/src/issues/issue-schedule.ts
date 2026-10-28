import { IssueState } from './enums';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** While someone has it on screen, and a little after. */
export const VIEW_WINDOW_MS = 10 * MINUTE;
/** A view of an issue last read longer ago than this asks for a fresh look. */
export const VIEW_STALE_MS = 2 * MINUTE;
/** How long a claimed issue is left alone if the process fetching it dies. */
export const FETCH_LEASE_MS = 2 * MINUTE;

export type IssueScheduleInput = {
  state: IssueState | null;
  now: Date;
  lastViewedAt: Date | null;
  /** Linked from a task that is not done, or from a thread in the last day. */
  isReferencedByActiveWork: boolean;
  /** A webhook covers the issue's repository and delivered recently. */
  webhooksActive: boolean;
};

/**
 * How long until Taico looks at an issue again, or null to stop until
 * something asks (a view, a webhook, a new link). Like pull requests, but
 * issues move slower: what is on screen is looked at often, what an open task
 * links to now and then. Closed issues are only read again when someone looks
 * at them, since they can be reopened.
 */
export function nextIssueFetchDelayMs(input: IssueScheduleInput): number | null {
  const now = input.now.getTime();
  if (input.lastViewedAt && now - input.lastViewedAt.getTime() < VIEW_WINDOW_MS) {
    return input.webhooksActive ? 10 * MINUTE : 1 * MINUTE;
  }
  if (input.state === IssueState.CLOSED) return null;
  if (input.isReferencedByActiveWork) {
    return input.webhooksActive ? HOUR : 10 * MINUTE;
  }
  return null;
}

/** After a failed look: 30s, 1m, 2m… up to an hour. */
export function retryDelayMs(failedFetches: number): number {
  return Math.min(HOUR, 30 * SECOND * 2 ** Math.max(0, failedFetches - 1));
}
