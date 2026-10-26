/**
 * Best-effort, in-process ceiling on accepted public submissions in a sliding
 * window. Not shared across replicas and reset on restart: it only bounds how
 * fast a single flood can fill the table. Strong/distributed rate limiting
 * belongs at the gateway, not here.
 */
export class SubmissionCeiling {
  private hits: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit and returns true if it is within the ceiling. */
  tryHit(now = Date.now()): boolean {
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.limit) return false;
    this.hits.push(now);
    return true;
  }
}
