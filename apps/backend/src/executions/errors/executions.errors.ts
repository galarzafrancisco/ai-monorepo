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

/** The agent already runs as many executions as its concurrency limit allows. */
export class AgentConcurrencyLimitReachedError extends ExecutionsError {
  constructor(agentActorId: string, limit: number) {
    super('The agent is already running as many tasks as its concurrency limit allows.', {
      agentActorId,
      limit,
    });
  }
}

export class ActiveTaskExecutionNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Active execution was not found.', { executionId });
  }
}

export class TaskExecutionHistoryEntryNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Finished execution was not found.', { executionId });
  }
}

export class ActiveTaskExecutionWorkerMismatchError extends ExecutionsError {
  constructor(executionId: string) {
    super('Active execution is claimed by a different worker.', { executionId });
  }
}

export class ExecutionStatsNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution stats were not found.', { executionId });
  }
}
