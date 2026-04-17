export abstract class ExecutionsError extends Error {
  constructor(message: string, readonly context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskExecutionQueueEntryNotFoundError extends ExecutionsError {
  constructor(taskId: string) {
    super('Task is not present in the execution queue.', { taskId });
  }
}

export class TaskAlreadyClaimedError extends ExecutionsError {
  constructor(taskId: string) {
    super('Task already has an active execution.', { taskId });
  }
}

export class ActiveTaskExecutionNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Active execution was not found.', { executionId });
  }
}

export class ExecutionStatsNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution stats were not found.', { executionId });
  }
}
