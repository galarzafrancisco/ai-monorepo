import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { IssuesService } from './issues.service';

/** How often each backend process looks for issues due for a look. */
export const ISSUE_POLL_INTERVAL_MS = 5_000;
/** Issues one process reads per tick. */
const BATCH_SIZE = 20;

/**
 * Reads issues that are due (see issue-schedule.ts). Every backend process
 * runs it; claims keep two processes off the same one.
 */
@Injectable()
export class IssuePollerService {
  private readonly logger = new Logger(IssuePollerService.name);
  private running = false;

  constructor(private readonly issues: IssuesService) {}

  @Interval(ISSUE_POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.issues.fetchDue(BATCH_SIZE);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to read due issues',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}
