import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ThreadAgentService } from '../agent/thread-agent.service';
import { ThreadWatchesService, ThreadWatchResult } from './thread-watches.service';
import { ThreadWatchKind } from './thread-watch.enums';
import { PullRequestWatchService } from './pull-request-watch.service';

const EXPIRY_SWEEP_INTERVAL_MS = 60_000;

/** Ends expired watches with a last notification, so no watch (or polling) lasts forever. */
@Injectable()
export class ThreadWatchExpiryService {
  private readonly logger = new Logger(ThreadWatchExpiryService.name);
  private running = false;

  constructor(
    private readonly watches: ThreadWatchesService,
    private readonly pullRequestWatches: PullRequestWatchService,
    private readonly threadAgentService: ThreadAgentService,
  ) {}

  @Interval(EXPIRY_SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const threadIds = await this.watches.expireDue((watch) => this.formatExpiry(watch));
      for (const threadId of threadIds) this.threadAgentService.requestTurn(threadId);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to expire thread watches',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }

  private formatExpiry(watch: ThreadWatchResult): string {
    switch (watch.kind) {
      case ThreadWatchKind.PULL_REQUEST:
        return this.pullRequestWatches.formatExpiry(watch);
    }
  }
}
