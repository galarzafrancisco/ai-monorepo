import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TaskEligibilityReconcilerService {
  private readonly logger = new Logger(TaskEligibilityReconcilerService.name);

  async reconcileTask(taskId: string): Promise<void> {
    this.logger.debug({
      message: 'Task eligibility reconciliation requested',
      taskId,
    });
  }

  async reconcileAllTasks(): Promise<void> {
    this.logger.debug({
      message: 'Full task eligibility reconciliation requested',
    });
  }
}
