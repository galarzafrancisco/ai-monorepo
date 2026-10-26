/** Small in-memory sliding-window limiter. Per-process; good enough as a first line of defence. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Returns true if allowed (and records the hit). */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      this.prune(now);
      if (this.hits.size >= this.maxKeys) return false;
    }
    this.hits.set(key, recent);
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) {
      if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
    }
  }
}
