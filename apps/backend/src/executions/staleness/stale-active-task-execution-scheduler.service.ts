import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackgroundWork } from '../background-work';
import { StaleActiveTaskExecutionDetectorService } from './stale-active-task-execution-detector.service';
import { StaleActiveTaskExecutionPrunerService } from './stale-active-task-execution-pruner.service';

// Every minute, so a worker that stopped is released within ~3 minutes.
const DEFAULT_STALE_SCAN_CRON = '* * * * *';
const STALE_SCAN_CRON_EXPRESSION =
  process.env.EXECUTIONS_STALENESS_SCAN_CRON?.trim() ||
  DEFAULT_STALE_SCAN_CRON;

@Injectable()
export class StaleActiveTaskExecutionSchedulerService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(
    StaleActiveTaskExecutionSchedulerService.name,
  );
  private readonly work = new BackgroundWork();

  constructor(
    private readonly staleExecutionDetector: StaleActiveTaskExecutionDetectorService,
    private readonly staleExecutionPruner: StaleActiveTaskExecutionPrunerService,
  ) {}

  @Cron(STALE_SCAN_CRON_EXPRESSION)
  pruneStaleExecutions(): Promise<void> {
    return this.work.run(() => this.pruneOnce());
  }

  /** Waits for a scan in flight; cron jobs are only stopped later, without waiting. */
  async beforeApplicationShutdown(): Promise<void> {
    await this.work.stop();
  }

  private async pruneOnce(): Promise<void> {
    try {
      const staleExecutions =
        await this.staleExecutionDetector.findStaleExecutions();

      if (staleExecutions.length === 0) {
        return;
      }

      const prunedCount =
        await this.staleExecutionPruner.pruneExecutions(staleExecutions);

      this.logger.log({
        message: 'Pruned stale active executions',
        staleExecutionsDetected: staleExecutions.length,
        prunedCount,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to prune stale active executions',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
