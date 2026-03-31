import { TaskExecutionEntity } from '../task-execution.entity';

/**
 * Domain events for the Executions domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 *
 * Each event uses a Symbol as its internal identifier to ensure type-safe,
 * non-string-based event emission within the domain layer.
 */

export type EventActor = {
  id: string;
};

export abstract class ExecutionDomainEvent<TPayload = unknown> {
  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly payload: TPayload,
  ) {}
}

export class ExecutionCreatedEvent extends ExecutionDomainEvent<TaskExecutionEntity> {
  static readonly INTERNAL = Symbol('executions.ExecutionCreatedEvent');

  constructor(actor: EventActor, execution: TaskExecutionEntity) {
    super(actor, execution);
  }
}

export class ExecutionUpdatedEvent extends ExecutionDomainEvent<TaskExecutionEntity> {
  static readonly INTERNAL = Symbol('executions.ExecutionUpdatedEvent');

  constructor(actor: EventActor, execution: TaskExecutionEntity) {
    super(actor, execution);
  }
}

export class ExecutionDeletedEvent {
  static readonly INTERNAL = Symbol('executions.ExecutionDeletedEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly executionId: string,
  ) {}
}
