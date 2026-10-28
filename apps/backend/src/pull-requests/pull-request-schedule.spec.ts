import { PullRequestState } from './enums';
import { nextFetchDelayMs, retryDelayMs } from './pull-request-schedule';

describe('nextFetchDelayMs', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const base = {
    state: PullRequestState.OPEN,
    now,
    watchedUntil: null,
    lastViewedAt: null,
    isReferencedByActiveWork: false,
    webhooksActive: false,
  };
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const minutesAhead = (m: number) => new Date(now.getTime() + m * 60_000);

  it('stops for finished pull requests, even watched ones', () => {
    expect(nextFetchDelayMs({ ...base, state: PullRequestState.MERGED, watchedUntil: minutesAhead(5) })).toBeNull();
    expect(nextFetchDelayMs({ ...base, state: PullRequestState.CLOSED })).toBeNull();
  });

  it('polls watched, then viewed, then active ones, and drops the rest', () => {
    expect(nextFetchDelayMs({ ...base, watchedUntil: minutesAhead(5) })).toBe(30_000);
    expect(nextFetchDelayMs({ ...base, watchedUntil: minutesAgo(1) })).toBeNull();
    expect(nextFetchDelayMs({ ...base, lastViewedAt: minutesAgo(3) })).toBe(60_000);
    expect(nextFetchDelayMs({ ...base, lastViewedAt: minutesAgo(30) })).toBeNull();
    expect(nextFetchDelayMs({ ...base, isReferencedByActiveWork: true })).toBe(300_000);
    expect(nextFetchDelayMs(base)).toBeNull();
  });

  it('slows down when webhooks are arriving', () => {
    expect(nextFetchDelayMs({ ...base, watchedUntil: minutesAhead(5), webhooksActive: true })).toBe(300_000);
    expect(nextFetchDelayMs({ ...base, isReferencedByActiveWork: true, webhooksActive: true })).toBe(1_800_000);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially up to an hour', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });
});
