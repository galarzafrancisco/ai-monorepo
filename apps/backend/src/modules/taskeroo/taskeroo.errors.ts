export class TaskNotFoundError extends Error {
  constructor(public readonly taskId: string) {
    super(`Task with id ${taskId} not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskNotAssignedError extends Error {
  constructor(public readonly taskId: string) {
    super(`Task with id ${taskId} is not assigned to anyone`);
    this.name = 'TaskNotAssignedError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly currentStatus: string,
    public readonly newStatus: string,
    public readonly reason: string,
  ) {
    super(
      `Cannot transition from ${currentStatus} to ${newStatus}: ${reason}`,
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

export class CommentRequiredError extends Error {
  constructor() {
    super('A comment is required when marking a task as done');
    this.name = 'CommentRequiredError';
  }
}
