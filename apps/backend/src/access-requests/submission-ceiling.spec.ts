import { SubmissionCeiling } from './submission-ceiling';

describe('SubmissionCeiling', () => {
  it('allows up to the limit within the window, then refuses', () => {
    const c = new SubmissionCeiling(2, 1000);
    expect(c.tryHit(0)).toBe(true);
    expect(c.tryHit(10)).toBe(true);
    expect(c.tryHit(20)).toBe(false);
  });

  it('frees capacity once hits age out of the window', () => {
    const c = new SubmissionCeiling(1, 1000);
    expect(c.tryHit(0)).toBe(true);
    expect(c.tryHit(999)).toBe(false);
    expect(c.tryHit(1000)).toBe(true);
  });
});
