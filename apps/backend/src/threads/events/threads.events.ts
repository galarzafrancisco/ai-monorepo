import { ThreadEntity } from '../thread.entity';
import { ThreadMessageEntity } from '../thread-message.entity';

/**
 * Domain events for the Threads domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 *
 * Each event uses a Symbol as its internal identifier to ensure type-safe,
 * non-string-based event emission within the domain layer.
 */

export type EventActor = {
  id: string;
};

export abstract class ThreadDomainEvent<TPayload = Record<string, never>> {
  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly payload: TPayload,
  ) {}
}

export class ThreadCreatedEvent extends ThreadDomainEvent<ThreadEntity> {
  static readonly INTERNAL = Symbol('threads.ThreadCreatedEvent');

  constructor(actor: EventActor, thread: ThreadEntity) {
    super(actor, thread);
  }
}

export class ThreadUpdatedEvent extends ThreadDomainEvent<ThreadEntity> {
  static readonly INTERNAL = Symbol('threads.ThreadUpdatedEvent');

  constructor(actor: EventActor, thread: ThreadEntity) {
    super(actor, thread);
  }
}

export class ThreadDeletedEvent {
  static readonly INTERNAL = Symbol('threads.ThreadDeletedEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly threadId: string,
  ) {}
}

export class MessageCreatedEvent extends ThreadDomainEvent<ThreadMessageEntity> {
  static readonly INTERNAL = Symbol('threads.MessageCreatedEvent');

  constructor(actor: EventActor, message: ThreadMessageEntity) {
    super(actor, message);
  }
}

export type ThreadAgentActivityKind = 'thinking' | 'tool_calling';

export type ThreadAgentActivityPayload = {
  threadId: string;
  kind: ThreadAgentActivityKind;
};

export class ThreadAgentActivityEvent extends ThreadDomainEvent<ThreadAgentActivityPayload> {
  static readonly INTERNAL = Symbol('threads.ThreadAgentActivityEvent');

  constructor(actor: EventActor, payload: ThreadAgentActivityPayload) {
    super(actor, payload);
  }
}

export type ThreadTitleUpdatedPayload = {
  threadId: string;
  title: string;
};

export class ThreadTitleUpdatedEvent extends ThreadDomainEvent<ThreadTitleUpdatedPayload> {
  static readonly INTERNAL = Symbol('threads.ThreadTitleUpdatedEvent');

  constructor(actor: EventActor, payload: ThreadTitleUpdatedPayload) {
    super(actor, payload);
  }
}
