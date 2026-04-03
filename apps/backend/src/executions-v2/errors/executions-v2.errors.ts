export abstract class ExecutionsV2Error extends Error {
  constructor(message: string, readonly context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskExecutionQueueEntryNotFoundError extends ExecutionsV2Error {
  constructor(taskId: string) {
    super('Task is not present in the execution queue.', { taskId });
  }
}

export class TaskAlreadyClaimedError extends ExecutionsV2Error {
  constructor(taskId: string) {
    super('Task already has an active execution.', { taskId });
  }
}

export class ActiveTaskExecutionNotFoundError extends ExecutionsV2Error {
  constructor(taskId: string) {
    super('Task does not have an active execution.', { taskId });
  }
}
