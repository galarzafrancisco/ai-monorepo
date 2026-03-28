import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ThreadsService } from '../threads/threads.service';
import { TaskExecutionNotFoundError } from './errors/executions.errors';
import { AgentRunNotFoundError } from '../agent-runs/errors/agent-runs.errors';

/**
 * Result of resolving execution context from either execution-id or run-id.
 * Contains the information needed for actor authorization and parent task/thread inheritance.
 */
export interface ExecutionContextResult {
  /**
   * The actor (agent) performing the execution
   */
  actorId: string;

  /**
   * The parent task being worked on
   */
  parentTaskId: string;

  /**
   * The parent thread, if the task belongs to one
   */
  parentThreadId: string | null;

  /**
   * The execution ID (authoritative in new model)
   */
  executionId: string | null;

  /**
   * The run ID (legacy compatibility)
   */
  runId: string | null;
}

/**
 * Service to resolve execution context from either execution-id (new) or run-id (legacy).
 * This enables migration from run-based to execution-based context propagation while maintaining
 * backward compatibility with old workers sending run-id headers.
 */
@Injectable()
export class ExecutionContextResolverService {
  private readonly logger = new Logger(ExecutionContextResolverService.name);

  constructor(
    @InjectRepository(TaskExecutionEntity)
    private readonly taskExecutionRepository: Repository<TaskExecutionEntity>,
    @InjectRepository(AgentRunEntity)
    private readonly agentRunRepository: Repository<AgentRunEntity>,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
  ) {}

  /**
   * Resolve execution context from execution-id (preferred) or run-id (compatibility).
   *
   * Resolution priority:
   * 1. If executionId provided, resolve from TaskExecution (authoritative)
   * 2. If runId provided, resolve from AgentRun (compatibility path)
   * 3. If both provided, executionId takes precedence
   *
   * @throws Error if neither ID is provided or if the ID is not found
   */
  async resolveContext(
    executionId: string | undefined,
    runId: string | undefined,
  ): Promise<ExecutionContextResult> {
    // Prefer execution-id (new execution-centric model)
    if (executionId) {
      return this.resolveFromExecutionId(executionId);
    }

    // Fall back to run-id (legacy compatibility)
    if (runId) {
      return this.resolveFromRunId(runId);
    }

    throw new Error(
      'Cannot resolve execution context: neither execution-id nor run-id provided',
    );
  }

  /**
   * Resolve context from TaskExecution (execution-centric, authoritative)
   */
  private async resolveFromExecutionId(
    executionId: string,
  ): Promise<ExecutionContextResult> {
    this.logger.debug({
      message: 'Resolving context from execution-id',
      executionId,
    });

    const execution = await this.taskExecutionRepository.findOne({
      where: { id: executionId },
      relations: ['task', 'agentActor'],
    });

    if (!execution) {
      throw new TaskExecutionNotFoundError(executionId);
    }

    // Look up thread by task ID
    const thread = await this.threadsService.findThreadByTaskId(
      execution.taskId,
    );
    const parentThreadId = thread?.id ?? null;

    this.logger.debug({
      message: 'Resolved context from execution-id',
      executionId,
      actorId: execution.agentActorId,
      parentTaskId: execution.taskId,
      parentThreadId,
    });

    return {
      actorId: execution.agentActorId,
      parentTaskId: execution.taskId,
      parentThreadId,
      executionId,
      runId: null, // No run-id in execution-centric path
    };
  }

  /**
   * Resolve context from AgentRun (legacy compatibility path)
   */
  private async resolveFromRunId(
    runId: string,
  ): Promise<ExecutionContextResult> {
    this.logger.debug({
      message: 'Resolving context from run-id (legacy compatibility)',
      runId,
    });

    const agentRun = await this.agentRunRepository.findOne({
      where: { id: runId },
      relations: ['parentTask', 'actor'],
    });

    if (!agentRun) {
      throw new AgentRunNotFoundError(runId);
    }

    // Look up thread by parent task ID
    const thread = await this.threadsService.findThreadByTaskId(
      agentRun.parentTaskId,
    );
    const parentThreadId = thread?.id ?? null;

    this.logger.debug({
      message: 'Resolved context from run-id',
      runId,
      actorId: agentRun.actorId,
      parentTaskId: agentRun.parentTaskId,
      parentThreadId,
      executionId: agentRun.taskExecutionId,
    });

    return {
      actorId: agentRun.actorId,
      parentTaskId: agentRun.parentTaskId,
      parentThreadId,
      executionId: agentRun.taskExecutionId,
      runId,
    };
  }
}
