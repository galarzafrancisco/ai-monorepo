import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StaleActiveTaskExecutionDetectorService } from './stale-active-task-execution-detector.service';
import { StaleActiveTaskExecutionPrunerService } from './stale-active-task-execution-pruner.service';

const DEFAULT_STALE_SCAN_CRON = '*/5 * * * *';
const STALE_SCAN_CRON_EXPRESSION =
  process.env.EXECUTIONS_STALENESS_SCAN_CRON?.trim() ||
  DEFAULT_STALE_SCAN_CRON;

@Injectable()
export class StaleActiveTaskExecutionSchedulerService {
  private readonly logger = new Logger(
    StaleActiveTaskExecutionSchedulerService.name,
  );

  constructor(
    private readonly staleExecutionDetector: StaleActiveTaskExecutionDetectorService,
    private readonly staleExecutionPruner: StaleActiveTaskExecutionPrunerService,
  ) {}

  @Cron(STALE_SCAN_CRON_EXPRESSION)
  async pruneStaleExecutions(): Promise<void> {
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
