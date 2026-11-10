import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackgroundWork } from '../background-work';
import { TaskExecutionQueuePopulatorService } from './task-execution-queue-populator.service';

@Injectable()
export class TaskEligibilitySchedulerService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(TaskEligibilitySchedulerService.name);
  private readonly work = new BackgroundWork();

  constructor(
    private readonly taskExecutionQueuePopulatorService: TaskExecutionQueuePopulatorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileAllTasks(): Promise<void> {
    this.logger.debug({
      message: 'Task execution queue population triggered by scheduler',
    });

    await this.work.run(() =>
      this.taskExecutionQueuePopulatorService.populateAllTasks(),
    );
  }

  /** Waits for a tick in flight; cron jobs are only stopped later, without waiting. */
  async beforeApplicationShutdown(): Promise<void> {
    await this.work.stop();
  }
}
