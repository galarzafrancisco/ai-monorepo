import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskExecutionQueuePopulatorService } from './task-execution-queue-populator.service';

@Injectable()
export class TaskEligibilitySchedulerService {
  private readonly logger = new Logger(TaskEligibilitySchedulerService.name);

  constructor(
    private readonly taskExecutionQueuePopulatorService: TaskExecutionQueuePopulatorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileAllTasks(): Promise<void> {
    this.logger.debug({
      message: 'Task execution queue population triggered by scheduler',
    });

    await this.taskExecutionQueuePopulatorService.populateAllTasks();
  }
}
