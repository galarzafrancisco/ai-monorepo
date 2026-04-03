import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskEligibilityReconcilerService } from './task-eligibility-reconciler.service';

@Injectable()
export class TaskEligibilitySchedulerService {
  private readonly logger = new Logger(TaskEligibilitySchedulerService.name);

  constructor(
    private readonly taskEligibilityReconcilerService: TaskEligibilityReconcilerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileAllTasks(): Promise<void> {
    this.logger.debug({
      message: 'Task eligibility reconciliation triggered by scheduler',
    });

    await this.taskEligibilityReconcilerService.reconcileAllTasks();
  }
}
