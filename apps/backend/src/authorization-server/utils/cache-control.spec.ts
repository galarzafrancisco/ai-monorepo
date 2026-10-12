import { cacheSeconds } from './cache-control';

describe('cacheSeconds', () => {
  it('uses max-age', () => {
    expect(cacheSeconds('public, max-age=3600')).toBe(3600);
  });

  it('falls back to 15 minutes without a usable header', () => {
    expect(cacheSeconds(null)).toBe(900);
    expect(cacheSeconds('public')).toBe(900);
  });

  it('never caches for less than a minute, so requests cannot force a fetch each time', () => {
    expect(cacheSeconds('max-age=0')).toBe(60);
    expect(cacheSeconds('no-store')).toBe(60);
    expect(cacheSeconds('no-cache, max-age=3600')).toBe(60);
  });

  it('never caches for more than a day', () => {
    expect(cacheSeconds('max-age=31536000')).toBe(86400);
  });
});
