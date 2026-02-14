import { ErrorCodes } from '@taico/errors';

/**
 * Domain-specific errors for task blueprints module.
 * These are thrown by the service layer and mapped to HTTP responses by exception filters.
 */

export class TaskBlueprintNotFoundError extends Error {
  code = ErrorCodes.TASK_BLUEPRINT_NOT_FOUND;

  constructor(blueprintId: string) {
    super(`Task blueprint not found: ${blueprintId}`);
    this.name = 'TaskBlueprintNotFoundError';
  }
}

export class TaskBlueprintHasActiveSchedulesError extends Error {
  code = ErrorCodes.TASK_BLUEPRINT_HAS_ACTIVE_SCHEDULES;

  constructor(blueprintId: string) {
    super(`Cannot delete task blueprint ${blueprintId} because it has active schedules`);
    this.name = 'TaskBlueprintHasActiveSchedulesError';
  }
}

export class ScheduledTaskNotFoundError extends Error {
  code = ErrorCodes.SCHEDULED_TASK_NOT_FOUND;

  constructor(scheduledTaskId: string) {
    super(`Scheduled task not found: ${scheduledTaskId}`);
    this.name = 'ScheduledTaskNotFoundError';
  }
}

export class InvalidCronExpressionError extends Error {
  code = ErrorCodes.INVALID_CRON_EXPRESSION;

  constructor(cronExpression: string, reason?: string) {
    super(
      `Invalid cron expression: ${cronExpression}${reason ? ` - ${reason}` : ''}`,
    );
    this.name = 'InvalidCronExpressionError';
  }
}
