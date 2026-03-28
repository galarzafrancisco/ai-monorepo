import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import { TaskExecutionStatus } from './enums';
import {
  ClaimExecutionInput,
  ClaimExecutionResult,
  RenewLeaseInput,
  RenewLeaseResult,
  ReleaseExecutionInput,
} from './dto/service/execution-claim.service.types';
import {
  TaskExecutionNotFoundError,
  TaskExecutionNotClaimableError,
  TaskExecutionAlreadyClaimedError,
} from './errors/executions.errors';

/**
 * ExecutionClaimService
 *
 * Provides atomic claim operations for TaskExecution with multi-worker safety.
 * Uses guarded SQL updates with optimistic locking to ensure only one worker
 * can claim a READY execution at a time.
 *
 * The claiming mechanism follows the same pattern as scheduled task claiming:
 * - Conditional UPDATE with WHERE clauses to ensure atomicity
 * - Lease-based ownership with expiration timestamps
 * - Status transitions to track execution lifecycle
 */
@Injectable()
export class ExecutionClaimService {
  private readonly logger = new Logger(ExecutionClaimService.name);

  constructor(
    @InjectRepository(TaskExecutionEntity)
    private readonly executionRepository: Repository<TaskExecutionEntity>,
  ) {}

  /**
   * Atomically claims a READY task execution for a worker session.
   *
   * This operation is multi-worker safe: it uses a guarded UPDATE that only
   * succeeds if the execution is in READY status and not currently claimed.
   *
   * @param input - Claim parameters including executionId, workerSessionId, and lease duration
   * @returns ClaimExecutionResult if successful, null if already claimed
   * @throws TaskExecutionNotFoundError if execution doesn't exist
   * @throws TaskExecutionNotClaimableError if execution is not in READY status
   */
  async claimExecution(
    input: ClaimExecutionInput,
  ): Promise<ClaimExecutionResult | null> {
    this.logger.debug({
      message: 'Attempting to claim execution',
      executionId: input.executionId,
      workerSessionId: input.workerSessionId,
      leaseDurationMs: input.leaseDurationMs,
    });

    // First, check if the execution exists and get its current state
    const execution = await this.executionRepository.findOne({
      where: { id: input.executionId },
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(input.executionId);
    }

    // Verify execution is in a claimable state
    if (execution.status !== TaskExecutionStatus.READY) {
      throw new TaskExecutionNotClaimableError(
        input.executionId,
        `Execution status is ${execution.status}, expected READY`,
      );
    }

    // If already claimed, throw error
    if (execution.workerSessionId !== null) {
      throw new TaskExecutionAlreadyClaimedError(
        input.executionId,
        execution.workerSessionId,
      );
    }

    const claimedAt = new Date();
    const leaseExpiresAt = new Date(
      claimedAt.getTime() + input.leaseDurationMs,
    );

    // Perform atomic claim using guarded UPDATE
    // This ensures only one worker can successfully claim the execution
    // Note: TypeORM doesn't auto-increment @VersionColumn in query builder,
    // so we explicitly increment row_version and update updated_at
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(TaskExecutionEntity)
      .set({
        status: TaskExecutionStatus.CLAIMED,
        workerSessionId: input.workerSessionId,
        claimedAt,
        leaseExpiresAt,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId: input.executionId })
      .andWhere('status = :readyStatus', {
        readyStatus: TaskExecutionStatus.READY,
      })
      .andWhere('worker_session_id IS NULL')
      .execute();

    // If no rows affected, execution was claimed by another worker
    if ((result.affected ?? 0) === 0) {
      this.logger.debug({
        message: 'Execution already claimed by another worker',
        executionId: input.executionId,
      });
      return null;
    }

    // Re-fetch the updated execution to get authoritative rowVersion and updatedAt
    const updatedExecution = await this.executionRepository.findOne({
      where: { id: input.executionId },
    });

    // This should never happen since we just updated it, but check for type safety
    if (!updatedExecution) {
      throw new TaskExecutionNotFoundError(input.executionId);
    }

    this.logger.log({
      message: 'Execution claimed successfully',
      executionId: input.executionId,
      workerSessionId: input.workerSessionId,
      leaseExpiresAt,
      rowVersion: updatedExecution.rowVersion,
    });

    return {
      executionId: input.executionId,
      taskId: updatedExecution.taskId,
      agentActorId: updatedExecution.agentActorId,
      claimedAt: updatedExecution.claimedAt!,
      leaseExpiresAt: updatedExecution.leaseExpiresAt!,
      rowVersion: updatedExecution.rowVersion,
    };
  }

  /**
   * Renews the lease on a claimed execution.
   *
   * This allows a worker to extend its ownership of an execution that is
   * taking longer than expected to complete.
   *
   * @param input - Renewal parameters including executionId, workerSessionId, and new lease duration
   * @returns RenewLeaseResult if successful, null if not owned by this worker
   * @throws TaskExecutionNotFoundError if execution doesn't exist
   */
  async renewLease(input: RenewLeaseInput): Promise<RenewLeaseResult | null> {
    this.logger.debug({
      message: 'Attempting to renew execution lease',
      executionId: input.executionId,
      workerSessionId: input.workerSessionId,
      leaseDurationMs: input.leaseDurationMs,
    });

    const execution = await this.executionRepository.findOne({
      where: { id: input.executionId },
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(input.executionId);
    }

    const newLeaseExpiresAt = new Date(Date.now() + input.leaseDurationMs);

    // Perform atomic lease renewal
    // Only succeeds if the execution is owned by the requesting worker
    // Explicitly increment row_version and update updated_at
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(TaskExecutionEntity)
      .set({
        leaseExpiresAt: newLeaseExpiresAt,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId: input.executionId })
      .andWhere('worker_session_id = :workerSessionId', {
        workerSessionId: input.workerSessionId,
      })
      .andWhere('status IN (:...activeStatuses)', {
        activeStatuses: [TaskExecutionStatus.CLAIMED, TaskExecutionStatus.RUNNING],
      })
      .execute();

    if ((result.affected ?? 0) === 0) {
      this.logger.debug({
        message: 'Failed to renew lease - not owned by this worker',
        executionId: input.executionId,
        workerSessionId: input.workerSessionId,
      });
      return null;
    }

    // Re-fetch to get authoritative rowVersion
    const updatedExecution = await this.executionRepository.findOne({
      where: { id: input.executionId },
    });

    if (!updatedExecution) {
      throw new TaskExecutionNotFoundError(input.executionId);
    }

    this.logger.log({
      message: 'Execution lease renewed successfully',
      executionId: input.executionId,
      workerSessionId: input.workerSessionId,
      newLeaseExpiresAt: updatedExecution.leaseExpiresAt!,
      rowVersion: updatedExecution.rowVersion,
    });

    return {
      executionId: input.executionId,
      leaseExpiresAt: updatedExecution.leaseExpiresAt!,
      rowVersion: updatedExecution.rowVersion,
    };
  }

  /**
   * Releases a claimed execution, returning it to READY status.
   *
   * This should be called when a worker cannot complete an execution
   * and wants to make it available for another worker to claim.
   *
   * @param input - Release parameters including executionId and workerSessionId
   * @returns true if released, false if not owned by this worker
   * @throws TaskExecutionNotFoundError if execution doesn't exist
   */
  async releaseExecution(input: ReleaseExecutionInput): Promise<boolean> {
    this.logger.debug({
      message: 'Attempting to release execution',
      executionId: input.executionId,
      workerSessionId: input.workerSessionId,
    });

    const execution = await this.executionRepository.findOne({
      where: { id: input.executionId },
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(input.executionId);
    }

    // Perform atomic release
    // Only succeeds if the execution is owned by the requesting worker
    // Explicitly increment row_version and update updated_at
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(TaskExecutionEntity)
      .set({
        status: TaskExecutionStatus.READY,
        workerSessionId: null,
        claimedAt: null,
        leaseExpiresAt: null,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId: input.executionId })
      .andWhere('worker_session_id = :workerSessionId', {
        workerSessionId: input.workerSessionId,
      })
      .andWhere('status = :claimedStatus', {
        claimedStatus: TaskExecutionStatus.CLAIMED,
      })
      .execute();

    if ((result.affected ?? 0) === 0) {
      this.logger.debug({
        message: 'Failed to release execution - not owned by this worker or not in CLAIMED state',
        executionId: input.executionId,
        workerSessionId: input.workerSessionId,
      });
      return false;
    }

    this.logger.log({
      message: 'Execution released successfully',
      executionId: input.executionId,
      workerSessionId: input.workerSessionId,
    });

    return true;
  }

  /**
   * Transitions a claimed execution to RUNNING status.
   *
   * This should be called when a worker begins actual work on the execution
   * after successfully claiming it.
   *
   * @param executionId - ID of the execution to start
   * @param workerSessionId - ID of the worker session that owns the execution
   * @returns true if started, false if not owned by this worker
   * @throws TaskExecutionNotFoundError if execution doesn't exist
   */
  async startExecution(
    executionId: string,
    workerSessionId: string,
  ): Promise<boolean> {
    this.logger.debug({
      message: 'Attempting to start execution',
      executionId,
      workerSessionId,
    });

    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(executionId);
    }

    const startedAt = new Date();

    // Explicitly increment row_version and update updated_at
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(TaskExecutionEntity)
      .set({
        status: TaskExecutionStatus.RUNNING,
        startedAt,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId })
      .andWhere('worker_session_id = :workerSessionId', { workerSessionId })
      .andWhere('status = :claimedStatus', {
        claimedStatus: TaskExecutionStatus.CLAIMED,
      })
      .execute();

    if ((result.affected ?? 0) === 0) {
      this.logger.debug({
        message: 'Failed to start execution - not owned by this worker or not in CLAIMED state',
        executionId,
        workerSessionId,
      });
      return false;
    }

    this.logger.log({
      message: 'Execution started successfully',
      executionId,
      workerSessionId,
      startedAt,
    });

    return true;
  }

  /**
   * Transitions a running execution to COMPLETED status.
   *
   * This should be called when a worker successfully completes the execution.
   * Only succeeds if the execution is owned by the requesting worker and in RUNNING status.
   *
   * @param executionId - ID of the execution to complete
   * @param workerSessionId - ID of the worker session that owns the execution
   * @param finishedAt - Timestamp when the execution finished
   * @returns true if completed, false if not owned by this worker or not in RUNNING state
   * @throws TaskExecutionNotFoundError if execution doesn't exist
   */
  async completeExecution(
    executionId: string,
    workerSessionId: string,
    finishedAt: Date,
  ): Promise<boolean> {
    this.logger.debug({
      message: 'Attempting to complete execution',
      executionId,
      workerSessionId,
    });

    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(executionId);
    }

    // Perform atomic completion with ownership verification
    // Explicitly increment row_version and update updated_at
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(TaskExecutionEntity)
      .set({
        status: TaskExecutionStatus.COMPLETED,
        finishedAt,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId })
      .andWhere('worker_session_id = :workerSessionId', { workerSessionId })
      .andWhere('status = :runningStatus', {
        runningStatus: TaskExecutionStatus.RUNNING,
      })
      .execute();

    if ((result.affected ?? 0) === 0) {
      this.logger.debug({
        message: 'Failed to complete execution - not owned by this worker or not in RUNNING state',
        executionId,
        workerSessionId,
      });
      return false;
    }

    this.logger.log({
      message: 'Execution completed successfully',
      executionId,
      workerSessionId,
      finishedAt,
    });

    return true;
  }

  /**
   * Transitions a running execution to FAILED status.
   *
   * This should be called when a worker encounters an error during execution.
   * Only succeeds if the execution is owned by the requesting worker and in RUNNING status.
   *
   * @param executionId - ID of the execution to fail
   * @param workerSessionId - ID of the worker session that owns the execution
   * @param finishedAt - Timestamp when the execution failed
   * @param failureReason - Reason for the failure
   * @returns true if failed, false if not owned by this worker or not in RUNNING state
   * @throws TaskExecutionNotFoundError if execution doesn't exist
   */
  async failExecution(
    executionId: string,
    workerSessionId: string,
    finishedAt: Date,
    failureReason: string,
  ): Promise<boolean> {
    this.logger.debug({
      message: 'Attempting to fail execution',
      executionId,
      workerSessionId,
      failureReason,
    });

    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(executionId);
    }

    // Perform atomic failure with ownership verification
    // Explicitly increment row_version and update updated_at
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(TaskExecutionEntity)
      .set({
        status: TaskExecutionStatus.FAILED,
        finishedAt,
        failureReason,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId })
      .andWhere('worker_session_id = :workerSessionId', { workerSessionId })
      .andWhere('status = :runningStatus', {
        runningStatus: TaskExecutionStatus.RUNNING,
      })
      .execute();

    if ((result.affected ?? 0) === 0) {
      this.logger.debug({
        message: 'Failed to fail execution - not owned by this worker or not in RUNNING state',
        executionId,
        workerSessionId,
      });
      return false;
    }

    this.logger.log({
      message: 'Execution failed successfully',
      executionId,
      workerSessionId,
      finishedAt,
      failureReason,
    });

    return true;
  }
}
