import { ErrorCodes } from "@taico/errors";

// Module-scoped re-export of error codes used by Executions
export const ExecutionsErrorCodes = {
  TASK_EXECUTION_NOT_FOUND: ErrorCodes.TASK_EXECUTION_NOT_FOUND,
} as const;

type ExecutionsErrorCode =
  (typeof ExecutionsErrorCodes)[keyof typeof ExecutionsErrorCodes];

/**
 * Base class for all Executions domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class ExecutionsDomainError extends Error {
  constructor(
    message: string,
    readonly code: ExecutionsErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskExecutionNotFoundError extends ExecutionsDomainError {
  constructor(executionId: string) {
    super('Task execution not found.', ExecutionsErrorCodes.TASK_EXECUTION_NOT_FOUND, {
      executionId,
    });
  }
}
