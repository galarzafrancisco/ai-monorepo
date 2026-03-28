import { TaskExecutionStatus } from '../../enums';

/**
 * Input for listing task executions with optional filtering
 */
export interface ListExecutionsInput {
  /**
   * Filter by execution status
   */
  status?: TaskExecutionStatus;

  /**
   * Filter by agent actor ID
   */
  agentActorId?: string;

  /**
   * Filter by task ID
   */
  taskId?: string;

  /**
   * Page number (1-indexed)
   */
  page?: number;

  /**
   * Number of items per page
   */
  limit?: number;
}

/**
 * Result for a single task execution with all relations
 */
export interface ExecutionResult {
  id: string;
  taskId: string;
  taskName: string | null;
  agentActorId: string;
  agentSlug: string | null;
  agentName: string | null;
  status: TaskExecutionStatus;
  requestedAt: Date;
  claimedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  workerSessionId: string | null;
  leaseExpiresAt: Date | null;
  stopRequestedAt: Date | null;
  failureReason: string | null;
  triggerReason: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result for listing task executions with pagination
 */
export interface ListExecutionsResult {
  items: ExecutionResult[];
  total: number;
  page: number;
  limit: number;
}
