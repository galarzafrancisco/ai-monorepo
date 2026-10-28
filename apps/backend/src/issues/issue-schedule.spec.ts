import { IssueState } from './enums';
import { nextIssueFetchDelayMs, retryDelayMs } from './issue-schedule';

describe('nextIssueFetchDelayMs', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const base = {
    state: IssueState.OPEN,
    now,
    lastViewedAt: null,
    isReferencedByActiveWork: false,
    webhooksActive: false,
  };
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it('polls viewed, then active ones, and drops the rest', () => {
    expect(nextIssueFetchDelayMs({ ...base, lastViewedAt: minutesAgo(3) })).toBe(60_000);
    expect(nextIssueFetchDelayMs({ ...base, lastViewedAt: minutesAgo(30) })).toBeNull();
    expect(nextIssueFetchDelayMs({ ...base, isReferencedByActiveWork: true })).toBe(600_000);
    expect(nextIssueFetchDelayMs(base)).toBeNull();
  });

  it('only polls closed issues while they are on screen', () => {
    expect(nextIssueFetchDelayMs({ ...base, state: IssueState.CLOSED, isReferencedByActiveWork: true })).toBeNull();
    expect(nextIssueFetchDelayMs({ ...base, state: IssueState.CLOSED, lastViewedAt: minutesAgo(1) })).toBe(60_000);
  });

  it('slows down when webhooks are arriving', () => {
    expect(nextIssueFetchDelayMs({ ...base, lastViewedAt: minutesAgo(1), webhooksActive: true })).toBe(600_000);
    expect(nextIssueFetchDelayMs({ ...base, isReferencedByActiveWork: true, webhooksActive: true })).toBe(3_600_000);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially up to an hour', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });
});
