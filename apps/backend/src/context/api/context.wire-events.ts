/**
 * WebSocket wire event names for Context domain.
 *
 * These are the stable, external event identifiers sent over the wire protocol.
 * They are decoupled from internal domain event naming and can evolve independently.
 *
 * Internal domain events use Symbols; these are the transport-layer strings.
 */
export const ContextWireEvents = {
  CONTEXT_BLOCK_CREATED: 'context.block.created',
  CONTEXT_BLOCK_UPDATED: 'context.block.updated',
  CONTEXT_BLOCK_DELETED: 'context.block.deleted',
} as const;

export type ContextWireEventName =
  (typeof ContextWireEvents)[keyof typeof ContextWireEvents];
