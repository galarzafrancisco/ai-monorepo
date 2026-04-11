import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThreadsService } from '../../threads/threads.service';
import { ActiveTaskExecutionEntity } from './active-task-execution.entity';
import { ActiveTaskExecutionNotFoundError } from '../errors/executions.errors';
import { AgentRunEntity } from '../../agent-runs/agent-run.entity';
import { AgentRunNotFoundError } from '../../agent-runs/errors/agent-runs.errors';

export type ExecutionContextResult = {
  actorId: string;
  parentTaskId: string;
  parentThreadId: string | null;
  executionId: string | null;
  runId: string | null;
};

@Injectable()
export class ActiveExecutionContextResolverService {
  constructor(
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
    @InjectRepository(AgentRunEntity)
    private readonly agentRunRepository: Repository<AgentRunEntity>,
    private readonly threadsService: ThreadsService,
  ) {}

  async resolveContext(
    executionId: string | undefined,
    runId: string | undefined,
  ): Promise<ExecutionContextResult> {
    // execution-id is authoritative for worker context.
    // If provided but not found, fail fast and do not fall back to run-id.
    if (executionId) {
      const activeExecution = await this.activeTaskExecutionRepository.findOne({
        where: { id: executionId },
      });

      if (!activeExecution) {
        throw new ActiveTaskExecutionNotFoundError(executionId);
      }

      const thread = await this.threadsService.findThreadByTaskId(
        activeExecution.taskId,
      );

      return {
        actorId: activeExecution.agentActorId,
        parentTaskId: activeExecution.taskId,
        parentThreadId: thread?.id ?? null,
        executionId,
        runId: null,
      };
    }

    // Compatibility path for agent-run context
    if (runId) {
      const agentRun = await this.agentRunRepository.findOne({
        where: { id: runId },
      });

      if (!agentRun) {
        throw new AgentRunNotFoundError(runId);
      }

      const thread = await this.threadsService.findThreadByTaskId(
        agentRun.parentTaskId,
      );

      return {
        actorId: agentRun.actorId,
        parentTaskId: agentRun.parentTaskId,
        parentThreadId: thread?.id ?? null,
        executionId: agentRun.taskExecutionId,
        runId,
      };
    }

    throw new Error(
      'Cannot resolve execution context: neither execution-id nor run-id provided',
    );
  }
}
