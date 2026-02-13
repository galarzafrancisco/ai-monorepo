import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { TaskBlueprintsService } from './task-blueprints.service';

/**
 * TaskSchedulerService runs scheduled tasks based on cron expressions.
 * It checks for due tasks every minute and creates tasks from blueprints.
 */
@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly scheduledTasksService: ScheduledTasksService,
    private readonly taskBlueprintsService: TaskBlueprintsService,
  ) {}

  /**
   * Runs every minute to check for due scheduled tasks
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledTasks() {
    this.logger.debug('Checking for due scheduled tasks');

    try {
      const dueTasks = await this.scheduledTasksService.getDueScheduledTasks();

      if (dueTasks.length === 0) {
        this.logger.debug('No due tasks found');
        return;
      }

      this.logger.log({
        message: 'Processing due scheduled tasks',
        count: dueTasks.length,
      });

      for (const scheduledTask of dueTasks) {
        try {
          // Create task from blueprint
          const task = await this.taskBlueprintsService.createTaskFromBlueprint(
            scheduledTask.taskBlueprintId,
          );

          // Mark scheduled task as executed
          await this.scheduledTasksService.markAsExecuted(scheduledTask.id);

          this.logger.log({
            message: 'Task created from scheduled blueprint',
            scheduledTaskId: scheduledTask.id,
            blueprintId: scheduledTask.taskBlueprintId,
            taskId: task.id,
            nextRunAt: scheduledTask.nextRunAt,
          });
        } catch (error) {
          this.logger.error({
            message: 'Failed to execute scheduled task',
            scheduledTaskId: scheduledTask.id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue processing other tasks even if one fails
        }
      }
    } catch (error) {
      this.logger.error({
        message: 'Error in scheduled task handler',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
