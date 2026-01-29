import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

// Module-scoped re-export of error codes used by Tasks
export const TasksErrorCodes = {
  TASK_NOT_FOUND: ErrorCodes.TASK_NOT_FOUND,
  TASK_NOT_ASSIGNED: ErrorCodes.TASK_NOT_ASSIGNED,
  INVALID_STATUS_TRANSITION: ErrorCodes.INVALID_STATUS_TRANSITION,
  COMMENT_REQUIRED: ErrorCodes.COMMENT_REQUIRED,
  AGENT_NOT_FOUND: ErrorCodes.AGENT_NOT_FOUND,
} as const;

type TasksErrorCode = (typeof TasksErrorCodes)[keyof typeof TasksErrorCodes];

/**
 * Base class for all Tasks domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class TasksDomainError extends Error {
  constructor(
    message: string,
    readonly code: TasksErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskNotFoundError extends TasksDomainError {
  constructor(taskId: string) {
    super('Task not found.', TasksErrorCodes.TASK_NOT_FOUND, { taskId });
  }
}

export class TaskNotAssignedError extends TasksDomainError {
  constructor(taskId: string) {
    super(
      'Task is not assigned to anyone.',
      TasksErrorCodes.TASK_NOT_ASSIGNED,
      { taskId },
    );
  }
}

export class InvalidStatusTransitionError extends TasksDomainError {
  constructor(currentStatus: string, newStatus: string, reason: string) {
    super(
      `Cannot transition from ${currentStatus} to ${newStatus}: ${reason}`,
      TasksErrorCodes.INVALID_STATUS_TRANSITION,
      { currentStatus, newStatus, reason },
    );
  }
}

export class CommentRequiredError extends TasksDomainError {
  constructor() {
    super(
      'A comment is required when marking a task as done.',
      TasksErrorCodes.COMMENT_REQUIRED,
    );
  }
}

export class ActorNotFoundError extends TasksDomainError {
  constructor(actorId: string) {
    super('Actor not found.', TasksErrorCodes.AGENT_NOT_FOUND, { actorId });
  }
}
