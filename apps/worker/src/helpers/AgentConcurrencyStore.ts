export class AgentConcurrencyStore {
  private readonly counts = new Map<string, number>();

  tryAcquire(actorId: string, limit: number | null): boolean {
    try {
      if (!actorId) return false;

      if (typeof limit === 'number' && limit > 0) {
        const current = this.counts.get(actorId) ?? 0;
        if (current >= limit) {
          return false;
        }
      }

      const current = this.counts.get(actorId) ?? 0;
      this.counts.set(actorId, current + 1);
      return true;
    } catch (error) {
      console.error('[concurrency] failed to acquire slot', error);
      return false;
    }
  }

  release(actorId: string): void {
    try {
      if (!actorId) return;

      const current = this.counts.get(actorId) ?? 0;
      if (current <= 1) {
        this.counts.delete(actorId);
        return;
      }

      this.counts.set(actorId, current - 1);
    } catch (error) {
      console.error('[concurrency] failed to release slot', error);
    }
  }

  getCount(actorId: string): number {
    return this.counts.get(actorId) ?? 0;
  }
}
