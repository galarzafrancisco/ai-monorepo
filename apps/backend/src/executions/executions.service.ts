import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import {
  ListExecutionsInput,
  ExecutionResult,
  ListExecutionsResult,
} from './dto/service/executions.service.types';

/**
 * ExecutionsService
 *
 * Provides read-only access to TaskExecution state for debug/monitoring purposes.
 * This is primarily for the rustic debug UI to visualize the work queue.
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
}
