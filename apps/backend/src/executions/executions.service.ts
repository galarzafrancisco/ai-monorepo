import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import { TaskExecutionStatus } from './enums';
import {
  ListExecutionsInput,
  ExecutionResult,
  ListExecutionsResult,
} from './dto/service/executions.service.types';

/**
 * ExecutionsService
 *
 * Provides access to TaskExecution state for debug/monitoring purposes
 * and lifecycle updates from workers.
 */
@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(
    @InjectRepository(TaskExecutionEntity)
    private readonly executionRepository: Repository<TaskExecutionEntity>,
  ) {}

  /**
   * List task executions with optional filtering and pagination.
   */
  async listExecutions(
    input: ListExecutionsInput,
  ): Promise<ListExecutionsResult> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const skip = (page - 1) * limit;

    // Build query with filters
    const queryBuilder = this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.task', 'task')
      .leftJoinAndSelect('execution.agentActor', 'agentActor')
      .leftJoinAndSelect('execution.workerSession', 'workerSession');

    // Apply filters
    if (input.status !== undefined) {
      queryBuilder.andWhere('execution.status = :status', {
        status: input.status,
      });
    }

    if (input.agentActorId) {
      queryBuilder.andWhere('execution.agentActorId = :agentActorId', {
        agentActorId: input.agentActorId,
      });
    }

    if (input.taskId) {
      queryBuilder.andWhere('execution.taskId = :taskId', {
        taskId: input.taskId,
      });
    }

    // Order by most recent first (by requestedAt)
    queryBuilder.orderBy('execution.requestedAt', 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination and get results
    const executions = await queryBuilder.skip(skip).take(limit).getMany();

    // Map to result type
    const items: ExecutionResult[] = executions.map((execution) => ({
      id: execution.id,
      taskId: execution.taskId,
      taskName: execution.task?.name ?? null,
      agentActorId: execution.agentActorId,
      agentSlug: execution.agentActor?.slug ?? null,
      agentName: execution.agentActor?.displayName ?? null,
      status: execution.status,
      requestedAt: execution.requestedAt,
      claimedAt: execution.claimedAt,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      workerSessionId: execution.workerSessionId,
      leaseExpiresAt: execution.leaseExpiresAt,
      stopRequestedAt: execution.stopRequestedAt,
      failureReason: execution.failureReason,
      triggerReason: execution.triggerReason,
      rowVersion: execution.rowVersion,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Find a task execution by ID.
   *
   * @param executionId - The execution ID
   * @returns The execution entity or null if not found
   */
  async findById(executionId: string): Promise<TaskExecutionEntity | null> {
    return this.executionRepository.findOne({
      where: { id: executionId },
    });
  }

  /**
   * Update the status of a task execution.
   *
   * @param executionId - The execution ID
   * @param status - The new status
   * @param updates - Optional additional fields to update
   */
  async updateStatus(
    executionId: string,
    status: TaskExecutionStatus,
    updates?: {
      finishedAt?: Date;
      failureReason?: string;
    },
  ): Promise<void> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      this.logger.warn({
        message: 'Attempted to update status of unknown execution',
        executionId,
      });
      return;
    }

    execution.status = status;
    if (updates?.finishedAt) {
      execution.finishedAt = updates.finishedAt;
    }
    if (updates?.failureReason) {
      execution.failureReason = updates.failureReason;
    }

    await this.executionRepository.save(execution);

    this.logger.log({
      message: 'Execution status updated',
      executionId,
      status,
    });
  }
}
