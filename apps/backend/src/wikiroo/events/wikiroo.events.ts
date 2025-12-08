import { WikiPageEntity } from '../page.entity';

/**
 * Domain events for the Wikiroo domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 */

export class PageCreatedEvent {
  constructor(public readonly page: WikiPageEntity) {}
}

export class PageUpdatedEvent {
  constructor(public readonly page: WikiPageEntity) {}
}

export class PageDeletedEvent {
  constructor(public readonly pageId: string) {}
}
