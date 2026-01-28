import { ContextBlockEntity } from '../block.entity';

/**
 * Domain events for the Context domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 */

export class BlockCreatedEvent {
  constructor(public readonly block: ContextBlockEntity) {}
}

export class BlockUpdatedEvent {
  constructor(public readonly block: ContextBlockEntity) {}
}

export class BlockDeletedEvent {
  constructor(public readonly blockId: string) {}
}
