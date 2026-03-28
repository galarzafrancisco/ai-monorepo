import { ErrorCodes } from "@taico/errors";

// Module-scoped re-export of error codes used by Executions
export const ExecutionsErrorCodes = {
  TASK_EXECUTION_NOT_FOUND: ErrorCodes.TASK_EXECUTION_NOT_FOUND,
  TASK_EXECUTION_NOT_CLAIMABLE: ErrorCodes.TASK_EXECUTION_NOT_CLAIMABLE,
  TASK_EXECUTION_ALREADY_CLAIMED: ErrorCodes.TASK_EXECUTION_ALREADY_CLAIMED,
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

export class TaskExecutionNotClaimableError extends ExecutionsDomainError {
  constructor(executionId: string, reason: string) {
    super(
      'Task execution is not claimable.',
      ExecutionsErrorCodes.TASK_EXECUTION_NOT_CLAIMABLE,
      { executionId, reason }
    );
  }
}

export class TaskExecutionAlreadyClaimedError extends ExecutionsDomainError {
  constructor(executionId: string, workerSessionId: string | null) {
    super(
      'Task execution is already claimed by another worker.',
      ExecutionsErrorCodes.TASK_EXECUTION_ALREADY_CLAIMED,
      { executionId, workerSessionId }
    );
  }
}
