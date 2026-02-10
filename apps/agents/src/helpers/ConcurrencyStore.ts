export class ConcurrencyStore {
  private readonly counts = new Map<string, number>();

  get(actorId: string): number {
    try {
      return this.counts.get(actorId) ?? 0;
    } catch (error) {
      console.error("[concurrency] Failed to read count", error);
      return 0;
    }
  }

  canRun(actorId: string, limit?: number | null): boolean {
    if (typeof limit !== "number" || Number.isNaN(limit)) {
      return true;
    }

    return this.get(actorId) < limit;
  }

  increment(actorId: string): number {
    try {
      const next = this.get(actorId) + 1;
      this.counts.set(actorId, next);
      return next;
    } catch (error) {
      console.error("[concurrency] Failed to increment", error);
      return this.get(actorId);
    }
  }

  decrement(actorId: string): number {
    try {
      const next = Math.max(0, this.get(actorId) - 1);
      this.counts.set(actorId, next);
      return next;
    } catch (error) {
      console.error("[concurrency] Failed to decrement", error);
      return this.get(actorId);
    }
  }
}
