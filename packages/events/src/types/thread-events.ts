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
}

/**
 * Thread structure as sent over the wire
 * Matches ThreadResponseDto from backend
 */
export interface ThreadWirePayload {
  id: string;
  title: string;
  chatSessionId: string | null;
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

export type ThreadAgentActivityKind = 'thinking' | 'tool_calling';

/**
 * Agent activity event
 * Emitted for ephemeral assistant actions (thinking/tool calling)
 */
export interface AgentActivityWireEvent {
  payload: {
    threadId: string;
    kind: ThreadAgentActivityKind;
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
  | AgentActivityWireEvent
  | AgentResponseDeltaWireEvent;
