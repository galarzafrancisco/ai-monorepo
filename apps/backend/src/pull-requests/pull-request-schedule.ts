import { PullRequestState } from './enums';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** While someone has it on screen, and a little after. */
export const VIEW_WINDOW_MS = 10 * MINUTE;
/** A view of a pull request last read longer ago than this asks for a fresh look. */
export const VIEW_STALE_MS = 2 * MINUTE;
/** How long a claimed pull request is left alone if the process fetching it dies. */
export const FETCH_LEASE_MS = 2 * MINUTE;

export type ScheduleInput = {
  state: PullRequestState | null;
  now: Date;
  watchedUntil: Date | null;
  lastViewedAt: Date | null;
  /** Linked from a task that is not done, or from a thread in the last day. */
  isReferencedByActiveWork: boolean;
  /** GitHub delivered a webhook for the pull request's connection in the last hour. */
  webhooksActive: boolean;
};

/**
 * How long until Taico looks at a pull request again, or null to stop until
 * something asks (a view, a webhook, a new link, a watch). Polling cost
 * follows demand: what is watched or on screen is looked at often, what an
 * open task links to now and then, and finished or forgotten ones never.
 * Webhooks make polling a slow safety net.
 */
export function nextFetchDelayMs(input: ScheduleInput): number | null {
  if (input.state === PullRequestState.MERGED || input.state === PullRequestState.CLOSED) {
    return null;
  }
  const now = input.now.getTime();
  if (input.watchedUntil && input.watchedUntil.getTime() > now) {
    return input.webhooksActive ? 5 * MINUTE : 30 * SECOND;
  }
  if (input.lastViewedAt && now - input.lastViewedAt.getTime() < VIEW_WINDOW_MS) {
    return input.webhooksActive ? 10 * MINUTE : 1 * MINUTE;
  }
  if (input.isReferencedByActiveWork) {
    return input.webhooksActive ? 30 * MINUTE : 5 * MINUTE;
  }
  return null;
}

/** After a failed look: 30s, 1m, 2m… up to an hour. */
export function retryDelayMs(failedFetches: number): number {
  return Math.min(HOUR, 30 * SECOND * 2 ** Math.max(0, failedFetches - 1));
}
