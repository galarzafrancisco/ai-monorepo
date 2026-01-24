import { TaskEntity } from '../task.entity';
import { CommentEntity } from '../comment.entity';

export type EventActor = {
  id: string;
};

export abstract class TaskDomainEvent<TPayload = unknown> {
  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly payload: TPayload,
  ) { }
}

/**
 * Domain events for the Tasks domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 */


export class TaskCreatedEvent extends TaskDomainEvent<TaskEntity> {
  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskUpdatedEvent extends TaskDomainEvent<TaskEntity> {
  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskAssignedEvent extends TaskDomainEvent<TaskEntity> {
  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskStatusChangedEvent extends TaskDomainEvent<TaskEntity> {
  constructor(actor: EventActor, task: TaskEntity) {
    super(actor, task);
  }
}

export class TaskDeletedEvent {
  readonly occurredAt: Date = new Date();
  constructor(
    public readonly actor: EventActor,
    public readonly taskId: string,
  ) { }
}

export class CommentAddedEvent extends TaskDomainEvent<CommentEntity> {
  constructor(actor: EventActor, comment: CommentEntity) {
    super(actor, comment);
  }
}