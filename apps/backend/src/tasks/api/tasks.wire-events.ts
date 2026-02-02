/**
 * WebSocket wire event names for Tasks domain.
 *
 * These are the stable, external event identifiers sent over the wire protocol.
 * They are decoupled from internal domain event naming and can evolve independently.
 *
 * Internal domain events use Symbols; these are the transport-layer strings.
 */
export const TaskWireEvents = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_ASSIGNED: 'task.assigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_COMMENTED: 'task.commented',
  INPUT_REQUEST_ANSWERED: 'input.request.answered',
  TASK_ACTIVITY: 'task.activity',
} as const;

export type TaskWireEventName =
  (typeof TaskWireEvents)[keyof typeof TaskWireEvents];
