import { ErrorCodes } from '@taico/errors';

// Module-scoped re-export of error codes used by Executions
export const ExecutionsErrorCodes = {
  TASK_EXECUTION_NOT_FOUND: ErrorCodes.TASK_EXECUTION_NOT_FOUND,
  TASK_EXECUTION_ALREADY_CLAIMED: ErrorCodes.TASK_EXECUTION_ALREADY_CLAIMED,
  TASK_EXECUTION_QUEUE_ENTRY_NOT_FOUND: ErrorCodes.TASK_EXECUTION_QUEUE_ENTRY_NOT_FOUND,
  TASK_EXECUTION_WORKER_MISMATCH: ErrorCodes.TASK_EXECUTION_WORKER_MISMATCH,
  AGENT_CONCURRENCY_LIMIT_REACHED: ErrorCodes.AGENT_CONCURRENCY_LIMIT_REACHED,
  EXECUTION_STATS_NOT_FOUND: ErrorCodes.EXECUTION_STATS_NOT_FOUND,
  INVALID_EXECUTION_TRACE: ErrorCodes.INVALID_EXECUTION_TRACE,
} as const;

type ExecutionsErrorCode = (typeof ExecutionsErrorCodes)[keyof typeof ExecutionsErrorCodes];

/**
 * Base class for all Executions domain errors.
 * Carries a `code` so the global problem-details filter maps it to HTTP via
 * the error catalog; keeps HTTP concerns out of the domain layer.
 */
export abstract class ExecutionsError extends Error {
  constructor(
    message: string,
    readonly code: ExecutionsErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskExecutionQueueEntryNotFoundError extends ExecutionsError {
  constructor(taskId: string) {
    super(
      'Task is not present in the execution queue.',
      ExecutionsErrorCodes.TASK_EXECUTION_QUEUE_ENTRY_NOT_FOUND,
      { taskId },
    );
  }
}

export class TaskAlreadyClaimedError extends ExecutionsError {
  constructor(taskId: string) {
    super('Task already has an active execution.', ExecutionsErrorCodes.TASK_EXECUTION_ALREADY_CLAIMED, {
      taskId,
    });
  }
}

/** The agent already runs as many executions as its concurrency limit allows. */
export class AgentConcurrencyLimitReachedError extends ExecutionsError {
  constructor(agentActorId: string, limit: number) {
    super(
      'The agent is already running as many tasks as its concurrency limit allows.',
      ExecutionsErrorCodes.AGENT_CONCURRENCY_LIMIT_REACHED,
      { agentActorId, limit },
    );
  }
}

export class ActiveTaskExecutionNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Active execution was not found.', ExecutionsErrorCodes.TASK_EXECUTION_NOT_FOUND, {
      executionId,
    });
  }
}

export class TaskExecutionHistoryEntryNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Finished execution was not found.', ExecutionsErrorCodes.TASK_EXECUTION_NOT_FOUND, {
      executionId,
    });
  }
}

export class ActiveTaskExecutionWorkerMismatchError extends ExecutionsError {
  constructor(executionId: string) {
    super(
      'Active execution is claimed by a different worker.',
      ExecutionsErrorCodes.TASK_EXECUTION_WORKER_MISMATCH,
      { executionId },
    );
  }
}

export class ExecutionStatsNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution stats were not found.', ExecutionsErrorCodes.EXECUTION_STATS_NOT_FOUND, {
      executionId,
    });
  }
}
