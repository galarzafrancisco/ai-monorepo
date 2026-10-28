import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PullRequestsService } from './pull-requests.service';

/** How often each backend process looks for pull requests due for a look. */
export const PULL_REQUEST_POLL_INTERVAL_MS = 5_000;
/** Pull requests one process reads per tick. */
const BATCH_SIZE = 20;

/**
 * Reads pull requests that are due (see pull-request-schedule.ts). Every
 * backend process runs it; claims keep two processes off the same one.
 */
@Injectable()
export class PullRequestPollerService {
  private readonly logger = new Logger(PullRequestPollerService.name);
  private running = false;

  constructor(private readonly pullRequests: PullRequestsService) {}

  @Interval(PULL_REQUEST_POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pullRequests.fetchDue(BATCH_SIZE);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to read due pull requests',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}
