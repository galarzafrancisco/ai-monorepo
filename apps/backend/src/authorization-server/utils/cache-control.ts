// How long a fetched document is reused. The lower bound stops a flood of
// authorization requests from turning into a flood of outbound fetches.
const MIN_CACHE_SECONDS = 60;
const DEFAULT_CACHE_SECONDS = 15 * 60;
const MAX_CACHE_SECONDS = 24 * 60 * 60;

/** Cache lifetime from a Cache-Control header, kept within sane bounds */
export function cacheSeconds(cacheControl: string | null): number {
  if (!cacheControl) {
    return DEFAULT_CACHE_SECONDS;
  }
  if (/\b(no-store|no-cache)\b/i.test(cacheControl)) {
    return MIN_CACHE_SECONDS;
  }
  const maxAge = /\bmax-age\s*=\s*"?(\d+)/i.exec(cacheControl);
  if (!maxAge) {
    return DEFAULT_CACHE_SECONDS;
  }
  return Math.min(
    MAX_CACHE_SECONDS,
    Math.max(MIN_CACHE_SECONDS, parseInt(maxAge[1], 10)),
  );
}
