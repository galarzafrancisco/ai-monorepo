/**
 * Worker Wire Event Types for WebSocket Communication
 *
 * These types define the structure of events sent between backend and workers
 * via WebSocket for the Workers domain. They serve as a contract between the
 * backend gateway and worker clients.
 *
 * Import these types in both backend (for emission/reception) and worker (for emission/reception)
 * to ensure type safety across the wire protocol.
 */

/**
 * Wire event names for Workers domain
 * These are the stable, external event identifiers sent over the wire protocol.
 */
export const WorkerWireEvents = {
  // Worker -> Backend
  WORKER_HELLO: 'worker.hello',
  WORKER_HEARTBEAT: 'worker.heartbeat',
  RUN_STARTED: 'run.started',
  RUN_COMPLETED: 'run.completed',
  RUN_FAILED: 'run.failed',

  // Backend -> Worker
  RUN_ASSIGNED: 'run.assigned',
  STOP_REQUESTED: 'stop.requested',
} as const;

export type WorkerWireEventName =
  (typeof WorkerWireEvents)[keyof typeof WorkerWireEvents];

/**
 * Worker hello message payload
 * Sent by worker on connection to register itself with metadata
 */
export interface WorkerHelloPayload {
  hostname?: string;
  pid?: number;
  version?: string;
  capabilities?: string[];
}

/**
 * Worker heartbeat message payload
 * Sent periodically by worker to indicate it's still alive
 */
export interface WorkerHeartbeatPayload {
  sessionId: string;
  timestamp: number;
}

/**
 * Run started message payload
 * Sent by worker when it begins executing a task
 */
export interface RunStartedPayload {
  executionId: string;
  sessionId: string;
  startedAt: string;
}

/**
 * Run completed message payload
 * Sent by worker when task execution finishes successfully
 */
export interface RunCompletedPayload {
  executionId: string;
  sessionId: string;
  completedAt: string;
}

/**
 * Run failed message payload
 * Sent by worker when task execution fails
 */
export interface RunFailedPayload {
  executionId: string;
  sessionId: string;
  failedAt: string;
  reason?: string;
}

/**
 * Run assigned wire event
 * Sent by backend to worker when a task execution is assigned
 */
export interface RunAssignedWireEvent {
  executionId: string;
  taskId: string;
  agentActorId: string;
  triggerReason?: string;
}

/**
 * Stop requested wire event
 * Sent by backend to worker to request stopping a running execution
 */
export interface StopRequestedWireEvent {
  executionId: string;
  taskId: string;
  reason?: string;
}

/**
 * Worker hello wire event
 * Response sent by backend after successful registration
 */
export interface WorkerHelloResponse {
  sessionId: string;
  serverTime: number;
}

/**
 * Worker heartbeat wire event
 * Response sent by backend after processing heartbeat
 */
export interface WorkerHeartbeatResponse {
  ok: boolean;
  serverTime: number;
}

/**
 * Generic acknowledgment for run lifecycle events
 */
export interface RunLifecycleAck {
  ok: boolean;
  executionId: string;
}
