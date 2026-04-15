/**
 * Domain event emitted when a task enters the execution queue.
 * This event signals that a task is ready to be claimed by a worker.
 */
export class TaskExecutionQueuedEvent {
  static readonly INTERNAL = Symbol('executions.TaskExecutionQueuedEvent');

  readonly occurredAt: Date = new Date();

  constructor(public readonly taskId: string) {}
}
