import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by Taskeroo
export const TaskerooErrorCodes = {
  TASK_NOT_FOUND: ErrorCodes.TASK_NOT_FOUND,
  TASK_NOT_ASSIGNED: ErrorCodes.TASK_NOT_ASSIGNED,
  INVALID_STATUS_TRANSITION: ErrorCodes.INVALID_STATUS_TRANSITION,
  COMMENT_REQUIRED: ErrorCodes.COMMENT_REQUIRED,
} as const;

type TaskerooErrorCode =
  typeof TaskerooErrorCodes[keyof typeof TaskerooErrorCodes];

/**
 * Base class for all Taskeroo domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class TaskerooDomainError extends Error {
  constructor(
    message: string,
    readonly code: TaskerooErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskNotFoundError extends TaskerooDomainError {
  constructor(taskId: string) {
    super('Task not found.', TaskerooErrorCodes.TASK_NOT_FOUND, { taskId });
  }
}

export class TaskNotAssignedError extends TaskerooDomainError {
  constructor(taskId: string) {
    super(
      'Task is not assigned to anyone.',
      TaskerooErrorCodes.TASK_NOT_ASSIGNED,
      { taskId },
    );
  }
}

export class InvalidStatusTransitionError extends TaskerooDomainError {
  constructor(currentStatus: string, newStatus: string, reason: string) {
    super(
      `Cannot transition from ${currentStatus} to ${newStatus}: ${reason}`,
      TaskerooErrorCodes.INVALID_STATUS_TRANSITION,
      { currentStatus, newStatus, reason },
    );
  }
}

export class CommentRequiredError extends TaskerooDomainError {
  constructor() {
    super(
      'A comment is required when marking a task as done.',
      TaskerooErrorCodes.COMMENT_REQUIRED,
    );
  }
}
