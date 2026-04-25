/**
 * Worker Wire Event Types for WebSocket Communication
 *
 * These types define the structure of events sent between backend and frontend
 * via WebSocket for the Workers domain. They serve as a contract between the
 * backend gateway and frontend consumers.
 *
 * Import these types in both backend (for emission) and frontend (for reception)
 * to ensure type safety across the wire protocol.
 */

/**
 * Wire event names for Workers domain
 * These are the stable, external event identifiers sent over the wire protocol.
 */
export const WorkerWireEvents = {
  WORKER_SEEN: 'worker.seen',
} as const;

export type WorkerWireEventName =
  (typeof WorkerWireEvents)[keyof typeof WorkerWireEvents];

/**
 * Worker structure as sent over the wire
 * Matches WorkerResponseDto from backend
 */
export interface WorkerWirePayload {
  id: string;
  oauthClientId: string;
  workerVersion: string | null;
  lastSeenAt: string;
  harnesses: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Worker seen event
 * Emitted when a worker is seen (connects, sends heartbeat, or executes)
 */
export interface WorkerSeenWireEvent {
  worker: WorkerWirePayload;
  occurredAt: string;
}

/**
 * Union type of all worker wire events
 */
export type WorkerWireEvent = WorkerSeenWireEvent;
