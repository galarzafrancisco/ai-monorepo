/**
 * Tracks work a service starts on its own (timers, cron ticks, event
 * handlers nobody awaits), so shutdown can refuse new runs and wait for
 * the ones in flight before the database connection is closed.
 *
 * Call `stop()` from `beforeApplicationShutdown`: Nest runs it for every
 * module before any `onApplicationShutdown`, which is where TypeORM
 * destroys its DataSource and `@nestjs/schedule` stops cron jobs.
 */
export class BackgroundWork {
  private stopped = false;
  private readonly inFlight = new Set<Promise<unknown>>();

  get isStopped(): boolean {
    return this.stopped;
  }

  /** Runs `work` unless shutdown has begun; then it resolves without running. */
  async run(work: () => Promise<void>): Promise<void> {
    if (this.stopped) return;
    const running = work();
    this.inFlight.add(running);
    try {
      await running;
    } finally {
      this.inFlight.delete(running);
    }
  }

  /** Refuses new runs and waits for those in flight (their errors stay with their callers). */
  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.allSettled([...this.inFlight]);
  }
}
