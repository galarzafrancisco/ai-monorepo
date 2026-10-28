/**
 * Thread Wire Event Types for WebSocket Communication
 *
 * These types define the structure of events sent between backend and frontend
 * via WebSocket for the Threads domain. They serve as a contract between the
 * backend gateway and frontend consumers.
 *
 * Import these types in both backend (for emission) and frontend (for reception)
 * to ensure type safety across the wire protocol.
 */

import type { MinimalEventActor, TagWirePayload } from './task-events.js';

/**
 * Wire event names for Threads domain
 * These are the stable, external event identifiers sent over the wire protocol.
 */
export const ThreadWireEvents = {
  THREAD_CREATED: 'thread.created',
  THREAD_UPDATED: 'thread.updated',
  THREAD_DELETED: 'thread.deleted',
  THREAD_TITLE_UPDATED: 'thread.title.updated',
  MESSAGE_CREATED: 'thread.message.created',
  THREAD_ACTIVITY: 'thread.activity',
  THREAD_READ: 'thread.read',
  THREAD_PINNED: 'thread.pinned',
  AGENT_ACTIVITY: 'thread.agent.activity',
  AGENT_RESPONSE_DELTA: 'thread.agent.response.delta',
} as const;

export type ThreadWireEventName =
  (typeof ThreadWireEvents)[keyof typeof ThreadWireEvents];

/**
 * Task summary structure as sent over the wire
 */
export interface TaskSummaryWirePayload {
  id: string;
  name: string;
  description: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  assigneeActor: Actor | null;
  createdByActor: Actor;
  tags: TagWirePayload[];
  commentCount: number;
  inputRequests: unknown[];
  updatedAt: string;
}

/**
 * Context block summary structure as sent over the wire
 */
export interface ContextBlockSummaryWirePayload {
  id: string;
  title: string;
}

export enum ActorType {
  HUMAN = 'human',
  AGENT = 'agent',
}
export interface Actor {
  id: string;
  type: ActorType;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  introduction: string | null;
  /** Set once the actor has been deleted; absent or null while active. */
  deletedAt?: string | null;
}

/**
 * Thread structure as sent over the wire
 * Matches ThreadResponseDto from backend
 */
export interface ThreadWirePayload {
  id: string;
  title: string;
  createdByActor: Actor;
  parentTaskId: string | null;
  stateContextBlockId: string;
  tags: TagWirePayload[];
  tasks: TaskSummaryWirePayload[];
  referencedContextBlocks: ContextBlockSummaryWirePayload[];
  participants: Actor[];
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Thread message structure as sent over the wire
 * Matches ThreadMessageResponseDto from backend
 */
export interface ThreadMessageWirePayload {
  id: string;
  threadId: string;
  content: string;
  createdByActorId: string | null;
  createdByActor: Actor | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Thread created event
 * Emitted when a new thread is created
 */
export interface ThreadCreatedWireEvent {
  payload: ThreadWirePayload;
  actor: MinimalEventActor;
}

/**
 * Thread updated event
 * Emitted when a thread is updated
 */
export interface ThreadUpdatedWireEvent {
  payload: ThreadWirePayload;
  actor: MinimalEventActor;
}

/**
 * Thread deleted event
 * Emitted when a thread is deleted
 */
export interface ThreadDeletedWireEvent {
  payload: {
    threadId: string;
  };
  actor: MinimalEventActor;
}

/**
 * Thread title updated event
 * Emitted when a thread title changes after initial creation.
 */
export interface ThreadTitleUpdatedWireEvent {
  payload: {
    threadId: string;
    title: string;
  };
  actor: MinimalEventActor;
}

/**
 * Message created event
 * Emitted when a message is created in a thread
 */
export interface MessageCreatedWireEvent {
  payload: ThreadMessageWirePayload;
  actor: MinimalEventActor;
}

/**
 * Thread activity event
 * Emitted to the thread list when a message people can see is posted in any
 * thread, so lists can move the thread up and show it as unread without
 * receiving the message itself.
 */
export interface ThreadActivityWireEvent {
  payload: {
    threadId: string;
    messageId: string;
    createdByActorId: string | null;
    /** When the message was posted: the thread's new `lastActivityAt`. ISO 8601. */
    createdAt: string;
  };
  actor: MinimalEventActor;
}

/**
 * Thread read event
 * Emitted only to the actor who read the thread, on all their connections, so
 * every tab and device clears its unread indicator.
 */
export interface ThreadReadWireEvent {
  payload: {
    threadId: string;
  };
  actor: MinimalEventActor;
}

/**
 * Thread pinned event
 * Emitted only to the actor who pinned or unpinned the thread, on all their
 * connections, so every tab and device moves it in or out of the pinned group.
 */
export interface ThreadPinnedWireEvent {
  payload: {
    threadId: string;
    pinned: boolean;
  };
  actor: MinimalEventActor;
}

export type ThreadAgentActivityKind = 'thinking' | 'tool_calling' | 'tool_result' | 'step_end' | 'turn_end';

/**
 * Agent activity event
 * Emitted for ephemeral assistant actions (thinking/tool calling)
 */
export interface AgentActivityWireEvent {
  payload: {
    threadId: string;
    kind: ThreadAgentActivityKind;
    turnId?: string;
    occurredAt?: string;
    toolCallId?: string;
    toolName?: string;
    input?: string;
    output?: string;
    failed?: boolean;
  };
  actor: MinimalEventActor;
}

/**
 * Agent response delta event
 * Emitted when assistant streaming text chunks are received.
 */
export interface AgentResponseDeltaWireEvent {
  payload: {
    threadId: string;
    streamId: string;
    delta: string;
  };
  actor: MinimalEventActor;
}

/**
 * Union type of all thread wire events
 */
export type ThreadWireEvent =
  | ThreadCreatedWireEvent
  | ThreadUpdatedWireEvent
  | ThreadDeletedWireEvent
  | ThreadTitleUpdatedWireEvent
  | MessageCreatedWireEvent
  | ThreadActivityWireEvent
  | ThreadReadWireEvent
  | ThreadPinnedWireEvent
  | AgentActivityWireEvent
  | AgentResponseDeltaWireEvent;
