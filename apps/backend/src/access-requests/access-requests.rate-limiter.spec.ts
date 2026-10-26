import { RateLimiter } from './access-requests.rate-limiter';

describe('RateLimiter', () => {
  it('blocks after the limit and recovers after the window', () => {
    const l = new RateLimiter(2, 1000);
    expect(l.hit('a', 0)).toBe(true);
    expect(l.hit('a', 10)).toBe(true);
    expect(l.hit('a', 20)).toBe(false);
    expect(l.hit('b', 20)).toBe(true);
    expect(l.hit('a', 1100)).toBe(true);
  });
});
