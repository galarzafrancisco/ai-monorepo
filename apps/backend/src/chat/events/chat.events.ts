import { SessionEntity } from '../session.entity';

export class SessionCreatedEvent {
  constructor(public readonly session: SessionEntity) {}
}

export class SessionUpdatedEvent {
  constructor(public readonly session: SessionEntity) {}
}

export class SessionDeletedEvent {
  constructor(public readonly sessionId: string) {}
}

export class TaskReferencedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {}
}

export class TaskSubscribedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {}
}

export class TaskUnsubscribedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {}
}
