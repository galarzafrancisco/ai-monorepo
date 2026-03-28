/**
 * Input for claiming a task execution
 */
export interface ClaimExecutionInput {
  /**
   * ID of the execution to claim
   */
  executionId: string;

  /**
   * ID of the worker session claiming the execution
   */
  workerSessionId: string;

  /**
   * Lease duration in milliseconds
   * After this time, the execution is considered stale and can be reclaimed
   */
  leaseDurationMs: number;
}

/**
 * Result of a successful claim operation
 */
export interface ClaimExecutionResult {
  /**
   * ID of the claimed execution
   */
  executionId: string;

  /**
   * Task ID associated with the execution
   */
  taskId: string;

  /**
   * Agent actor ID for the execution
   */
  agentActorId: string;

  /**
   * Timestamp when the claim was made
   */
  claimedAt: Date;

  /**
   * Timestamp when the lease expires
   */
  leaseExpiresAt: Date;

  /**
   * Row version after the claim
   */
  rowVersion: number;
}

/**
 * Input for renewing an execution lease
 */
export interface RenewLeaseInput {
  /**
   * ID of the execution to renew
   */
  executionId: string;

  /**
   * ID of the worker session that owns the execution
   */
  workerSessionId: string;

  /**
   * New lease duration in milliseconds
   */
  leaseDurationMs: number;
}

/**
 * Result of a successful lease renewal
 */
export interface RenewLeaseResult {
  /**
   * ID of the execution
   */
  executionId: string;

  /**
   * New lease expiration timestamp
   */
  leaseExpiresAt: Date;

  /**
   * Row version after the renewal
   */
  rowVersion: number;
}

/**
 * Input for releasing an execution
 */
export interface ReleaseExecutionInput {
  /**
   * ID of the execution to release
   */
  executionId: string;

  /**
   * ID of the worker session that owns the execution (for verification)
   */
  workerSessionId: string;
}
