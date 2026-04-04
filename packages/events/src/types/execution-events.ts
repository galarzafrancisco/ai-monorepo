/**
 * Execution Wire Event Types for WebSocket Communication
 *
 * These types define the structure of events sent between backend and frontend
 * via WebSocket for the Executions domain. They serve as a contract between the
 * backend gateway and frontend consumers.
 *
 * Import these types in both backend (for emission) and frontend (for reception)
 * to ensure type safety across the wire protocol.
 */

import type { EventActor, MinimalEventActor } from './task-events.js';

/**
 * Wire event names for Executions domain
 * These are the stable, external event identifiers sent over the wire protocol.
 */
export const ExecutionWireEvents = {
  EXECUTION_CREATED: 'execution.created',
  EXECUTION_UPDATED: 'execution.updated',
  EXECUTION_DELETED: 'execution.deleted',
  EXECUTION_ACTIVITY: 'execution.activity',
  EXECUTION_ACTIVITY_POST: 'execution.activity.post',
  EXECUTION_HEARTBEAT_POST: 'execution.heartbeat.post',
} as const;

export type ExecutionWireEventName =
  (typeof ExecutionWireEvents)[keyof typeof ExecutionWireEvents];

/**
 * Execution structure as sent over the wire
 * Matches ExecutionResponseDto from backend
 */
export interface ExecutionWirePayload {
  id: string;
  taskId: string;
  taskName: string | null;
  agentActorId: string;
  agentSlug: string | null;
  agentName: string | null;
  status: 'READY' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  requestedAt: string;
  claimedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  workerSessionId: string | null;
  leaseExpiresAt: string | null;
  stopRequestedAt: string | null;
  failureReason: string | null;
  triggerReason: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution created event
 * Emitted when a new execution is created
 */
export interface ExecutionCreatedWireEvent {
  payload: ExecutionWirePayload;
  actor: MinimalEventActor;
}

/**
 * Execution updated event
 * Emitted when an execution is updated
 */
export interface ExecutionUpdatedWireEvent {
  payload: ExecutionWirePayload;
  actor: MinimalEventActor;
}

/**
 * Execution deleted event
 * Emitted when an execution is deleted
 */
export interface ExecutionDeletedWireEvent {
  payload: {
    executionId: string;
  };
  actor: MinimalEventActor;
}

export interface ExecutionActivityPayload {
  executionId: string;
  taskId: string;
  agentActorId: string;
  kind: string;
  message?: string;
  ts: number;
  runnerSessionId?: string | null;
}

export interface PostExecutionActivityPayload {
  executionId: string;
  kind?: string;
  message?: string;
  ts?: number;
  runnerSessionId?: string | null;
}

export interface PostExecutionHeartbeatPayload {
  executionId: string;
}

/**
 * Execution activity event
 * Emitted for real-time activity updates from workers/runners
 */
export interface ExecutionActivityWireEvent {
  payload: ExecutionActivityPayload;
  actor: MinimalEventActor;
}

/**
 * Union type of all execution wire events
 */
export type ExecutionWireEvent =
  | ExecutionCreatedWireEvent
  | ExecutionUpdatedWireEvent
  | ExecutionDeletedWireEvent
  | ExecutionActivityWireEvent;

/**
 * Type guards for event identification
 */
export function isExecutionCreatedEvent(
  event: ExecutionWireEvent,
): event is ExecutionCreatedWireEvent {
  return 'payload' in event && 'id' in event.payload && 'taskId' in event.payload;
}

export function isExecutionDeletedEvent(
  event: ExecutionWireEvent,
): event is ExecutionDeletedWireEvent {
  return 'payload' in event && 'executionId' in event.payload;
}
