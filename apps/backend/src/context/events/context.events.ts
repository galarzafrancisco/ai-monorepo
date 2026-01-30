import { ContextBlockEntity } from '../block.entity';

/**
 * Domain events for the Context domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 *
 * Each event uses a Symbol as its internal identifier to ensure type-safe,
 * non-string-based event emission within the domain layer.
 */

export type EventActor = {
  id: string;
};

export class BlockCreatedEvent {
  static readonly INTERNAL = Symbol('context.BlockCreatedEvent');

  constructor(
    public readonly block: ContextBlockEntity,
    public readonly actor: EventActor,
  ) {}
}

export class BlockUpdatedEvent {
  static readonly INTERNAL = Symbol('context.BlockUpdatedEvent');

  constructor(
    public readonly block: ContextBlockEntity,
    public readonly actor: EventActor,
  ) {}
}

export class BlockDeletedEvent {
  static readonly INTERNAL = Symbol('context.BlockDeletedEvent');

  constructor(
    public readonly blockId: string,
    public readonly actor: EventActor,
  ) {}
}
