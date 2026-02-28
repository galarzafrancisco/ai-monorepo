export type KeyedDebounceBatchProcessorOptions<TKey extends string, TItem> = {
  delayMs: number;
  handleBatch: (key: TKey, items: TItem[]) => Promise<void>;
  onError?: (key: TKey, error: Error) => void;
};

export class KeyedDebounceBatchProcessor<TKey extends string, TItem> {
  private readonly timers = new Map<TKey, NodeJS.Timeout>();
  private readonly pending = new Map<TKey, TItem[]>();
  private readonly inFlight = new Set<TKey>();
  private readonly rerunRequested = new Set<TKey>();

  constructor(
    private readonly options: KeyedDebounceBatchProcessorOptions<TKey, TItem>,
  ) {}

  enqueue(key: TKey, item: TItem): void {
    const existing = this.pending.get(key);
    if (existing) {
      existing.push(item);
    } else {
      this.pending.set(key, [item]);
    }

    this.schedule(key);
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
    this.pending.clear();
    this.inFlight.clear();
    this.rerunRequested.clear();
  }

  private schedule(key: TKey): void {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.flush(key);
    }, this.options.delayMs);

    this.timers.set(key, timer);
  }

  private async flush(key: TKey): Promise<void> {
    if (this.inFlight.has(key)) {
      this.rerunRequested.add(key);
      return;
    }

    const batch = this.pending.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    this.pending.delete(key);
    this.inFlight.add(key);

    try {
      await this.options.handleBatch(key, batch);
    } catch (error) {
      if (this.options.onError) {
        const asError = error instanceof Error ? error : new Error(String(error));
        this.options.onError(key, asError);
      }
    } finally {
      this.inFlight.delete(key);
    }

    const shouldRerun = this.rerunRequested.has(key);
    if (shouldRerun) {
      this.rerunRequested.delete(key);
    }

    if (shouldRerun || (this.pending.get(key)?.length ?? 0) > 0) {
      this.schedule(key);
    }
  }
}
