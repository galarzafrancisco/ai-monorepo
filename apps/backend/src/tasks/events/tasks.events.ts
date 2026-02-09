import { TaskEntity } from '../task.entity';
import { CommentEntity } from '../comment.entity';
import { ArtefactEntity } from '../artefact.entity';
import { InputRequestEntity } from '../input-request.entity';

/**
 * Domain events for the Tasks domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 *
 * Each event uses a Symbol as its internal identifier to ensure type-safe,
 * non-string-based event emission within the domain layer.
 */

export type EventActor = {
  id: string;
};

export abstract class TaskDomainEvent<TPayload = unknown> {
  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly payload: TPayload,
  ) {}
}

export class TaskCreatedEvent extends TaskDomainEvent<TaskEntity> {
  static readonly INTERNAL = Symbol('tasks.TaskCreatedEvent');

  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskUpdatedEvent extends TaskDomainEvent<TaskEntity> {
  static readonly INTERNAL = Symbol('tasks.TaskUpdatedEvent');

  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskAssignedEvent extends TaskDomainEvent<TaskEntity> {
  static readonly INTERNAL = Symbol('tasks.TaskAssignedEvent');

  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskStatusChangedEvent extends TaskDomainEvent<TaskEntity> {
  static readonly INTERNAL = Symbol('tasks.TaskStatusChangedEvent');

  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskDeletedEvent {
  static readonly INTERNAL = Symbol('tasks.TaskDeletedEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly taskId: string,
  ) {}
}

export class CommentAddedEvent extends TaskDomainEvent<CommentEntity> {
  static readonly INTERNAL = Symbol('tasks.CommentAddedEvent');

  constructor(actor: EventActor, comment: CommentEntity) {
    super(actor, comment);
  }
}

export class ArtefactAddedEvent extends TaskDomainEvent<ArtefactEntity> {
  static readonly INTERNAL = Symbol('tasks.ArtefactAddedEvent');

  constructor(actor: EventActor, artefact: ArtefactEntity) {
    super(actor, artefact);
  }
}

export class InputRequestAnsweredEvent extends TaskDomainEvent<InputRequestEntity> {
  static readonly INTERNAL = Symbol('tasks.InputRequestAnsweredEvent');

  constructor(actor: EventActor, inputRequest: InputRequestEntity) {
    super(actor, inputRequest);
  }
}
