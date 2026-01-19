import { ContextPageEntity } from '../page.entity';

/**
 * Domain events for the Context domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 */

export class PageCreatedEvent {
  constructor(public readonly page: ContextPageEntity) {}
}

export class PageUpdatedEvent {
  constructor(public readonly page: ContextPageEntity) {}
}

export class PageDeletedEvent {
  constructor(public readonly pageId: string) {}
}
