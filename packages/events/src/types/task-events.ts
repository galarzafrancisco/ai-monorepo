/**
 * Task Wire Event Types for WebSocket Communication
 *
 * These types define the structure of events sent between backend and frontend
 * via WebSocket for the Tasks domain. They serve as a contract between the
 * backend gateway and frontend consumers.
 *
 * Import these types in both backend (for emission) and frontend (for reception)
 * to ensure type safety across the wire protocol.
 */

/**
 * Wire event names for Tasks domain
 * These are the stable, external event identifiers sent over the wire protocol.
 */
export const TaskWireEvents = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_ASSIGNED: 'task.assigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_COMMENTED: 'task.commented',
  TASK_ARTEFACT_ADDED: 'task.artefact_added',
  INPUT_REQUEST_ANSWERED: 'input.request.answered',
  TASK_ACTIVITY: 'task.activity',
  TASK_ACTIVITY_POST: 'task.activity.post',
} as const;

export type TaskWireEventName =
  (typeof TaskWireEvents)[keyof typeof TaskWireEvents];

/**
 * Base actor structure included in all events
 */
export interface EventActor {
  id: string;
  type?: string;
  slug?: string;
  displayName?: string;
  avatarUrl?: string | null;
}

/**
 * Actor structure for minimal event payloads
 */
export interface MinimalEventActor {
  id: string;
}

/**
 * Task structure as sent over the wire
 * Matches TaskResponseDto from backend
 */
export interface TaskWirePayload {
  id: string;
  name: string;
  description: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  assignee: string | null;
  assigneeActor: EventActor | null;
  sessionId: string;
  comments: CommentWirePayload[];
  artefacts: ArtefactWirePayload[];
  inputRequests: InputRequestWirePayload[];
  tags: TagWirePayload[];
  createdByActor: EventActor;
  dependsOnIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Comment structure as sent over the wire
 * Matches CommentResponseDto from backend
 */
export interface CommentWirePayload {
  id: string;
  taskId: string;
  commenterName: string;
  commenterActor: EventActor | null;
  content: string;
  createdAt: string;
}

/**
 * Artefact structure as sent over the wire
 * Matches ArtefactResponseDto from backend
 */
export interface ArtefactWirePayload {
  id: string;
  taskId: string;
  name: string;
  link: string;
  createdAt: string;
}

/**
 * Input request structure as sent over the wire
 * Matches InputRequestResponseDto from backend
 */
export interface InputRequestWirePayload {
  id: string;
  taskId: string;
  askedByActorId: string;
  assignedToActorId: string;
  question: string;
  answer: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tag structure as sent over the wire
 * Matches TagResponseDto from backend
 */
export interface TagWirePayload {
  id: string;
  name: string;
  color?: string;
}

/**
 * Task created event
 * Emitted when a new task is created
 */
export interface TaskCreatedWireEvent {
  payload: TaskWirePayload;
  actor: MinimalEventActor;
}

/**
 * Task updated event
 * Emitted when a task is updated
 */
export interface TaskUpdatedWireEvent {
  payload: TaskWirePayload;
  actor: MinimalEventActor;
}

/**
 * Task deleted event
 * Emitted when a task is deleted
 */
export interface TaskDeletedWireEvent {
  payload: {
    taskId: string;
  };
  actor: MinimalEventActor;
}

/**
 * Task assigned event
 * Emitted when a task is assigned to an actor
 */
export interface TaskAssignedWireEvent {
  payload: TaskWirePayload;
  actor: MinimalEventActor;
}

/**
 * Task status changed event
 * Emitted when a task's status changes
 */
export interface TaskStatusChangedWireEvent {
  payload: TaskWirePayload;
  actor: MinimalEventActor;
}

/**
 * Comment added event
 * Emitted when a comment is added to a task
 */
export interface TaskCommentedWireEvent {
  payload: CommentWirePayload;
  actor: MinimalEventActor;
}

/**
 * Artefact added event
 * Emitted when an artefact is added to a task
 */
export interface TaskArtefactAddedWireEvent {
  payload: ArtefactWirePayload;
  actor: MinimalEventActor;
}

/**
 * Input request answered event
 * Emitted when an input request is answered
 */
export interface InputRequestAnsweredWireEvent {
  payload: InputRequestWirePayload;
  actor: MinimalEventActor;
}

/**
 * Task activity event (ephemeral)
 * Emitted for real-time activity updates (e.g., agent working on task)
 */
export interface TaskActivityWireEvent {
  taskId: string;
  kind: string;
  message?: string;
  ts: number;
  by?: string;
}

/**
 * Union type of all task wire events
 */
export type TaskWireEvent =
  | TaskCreatedWireEvent
  | TaskUpdatedWireEvent
  | TaskDeletedWireEvent
  | TaskAssignedWireEvent
  | TaskStatusChangedWireEvent
  | TaskCommentedWireEvent
  | TaskArtefactAddedWireEvent
  | InputRequestAnsweredWireEvent;

/**
 * Type guards for event identification
 */
export function isTaskCreatedEvent(
  event: TaskWireEvent,
): event is TaskCreatedWireEvent {
  return 'payload' in event && 'id' in event.payload && 'name' in event.payload;
}

export function isTaskDeletedEvent(
  event: TaskWireEvent,
): event is TaskDeletedWireEvent {
  return 'payload' in event && 'taskId' in event.payload;
}

export function isTaskCommentedEvent(
  event: TaskWireEvent,
): event is TaskCommentedWireEvent {
  return (
    'payload' in event && 'taskId' in event.payload && 'content' in event.payload
  );
}
