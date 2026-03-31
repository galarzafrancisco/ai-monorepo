/**
 * Execution types for the UI
 * These match the ExecutionResponseDto from the backend
 */

export type ExecutionStatus =
  | 'READY'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Execution {
  id: string;
  taskId: string;
  taskName: string | null;
  agentActorId: string;
  agentSlug: string | null;
  agentName: string | null;
  status: ExecutionStatus;
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
