import { TaskEntity } from '../task.entity';
import { CommentEntity } from '../comment.entity';

/**
 * Domain events for the Taskeroo domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 */

export class TaskCreatedEvent {
  constructor(public readonly task: TaskEntity) {}
}

export class TaskUpdatedEvent {
  constructor(public readonly task: TaskEntity) {}
}

export class TaskAssignedEvent {
  constructor(public readonly task: TaskEntity) {}
}

export class TaskDeletedEvent {
  constructor(public readonly taskId: string) {}
}

export class CommentAddedEvent {
  constructor(public readonly comment: CommentEntity) {}
}

export class TaskStatusChangedEvent {
  constructor(public readonly task: TaskEntity) {}
}
