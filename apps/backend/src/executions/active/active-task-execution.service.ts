import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ActiveTaskExecutionEntity,
  type ActiveTaskExecutionTagSnapshot,
} from './active-task-execution.entity';
import { TaskExecutionHistoryEntity } from '../history/task-execution-history.entity';
import { TaskExecutionHistoryErrorCode } from '../history/task-execution-history-error-code.enum';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import {
  TaskNotAssignedError,
  TaskNotFoundError,
} from '../../tasks/errors/tasks.errors';
import {
  ActiveTaskExecutionNotFoundError,
  TaskAlreadyClaimedError,
  TaskExecutionQueueEntryNotFoundError,
} from '../errors/executions.errors';
import { ExecutionActivityService } from '../execution-activity.service';

export type ClaimTaskExecutionInput = {
  taskId: string;
  workerClientId: string;
};

export type StopTaskExecutionInput = {
  executionId: string;
  workerClientId: string;
  status: TaskExecutionHistoryStatus;
  errorCode?: TaskExecutionHistoryErrorCode | null;
  errorMessage?: string | null;
};

export type UpdateRunnerSessionIdInput = {
  executionId: string;
  runnerSessionId: string;
};

export type IncrementToolCallCountInput = {
  executionId: string;
};

@Injectable()
export class ActiveTaskExecutionService {
  constructor(
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
    private readonly dataSource: DataSource,
    private readonly executionActivityService: ExecutionActivityService,
  ) {}

  async listActiveExecutions(): Promise<ActiveTaskExecutionEntity[]> {
    return this.activeTaskExecutionRepository.find({
      relations: ['task'],
      order: { claimedAt: 'DESC' },
    });
  }

  async claimTask(
    input: ClaimTaskExecutionInput,
  ): Promise<ActiveTaskExecutionEntity> {
    const execution = await this.dataSource.transaction(async (manager) => {
      const task = await manager.findOne(TaskEntity, {
        where: { id: input.taskId },
        relations: ['tags'],
      });

      if (!task) {
        throw new TaskNotFoundError(input.taskId);
      }

      const deleteResult = await manager.delete(TaskExecutionQueueEntity, {
        taskId: input.taskId,
      });

      if ((deleteResult.affected ?? 0) === 0) {
        const existingActiveExecution = await manager.findOne(
          ActiveTaskExecutionEntity,
          {
            where: { taskId: input.taskId },
          },
        );

        if (existingActiveExecution) {
          throw new TaskAlreadyClaimedError(input.taskId);
        }

        throw new TaskExecutionQueueEntryNotFoundError(input.taskId);
      }

      const assigneeActorId = task.assigneeActorId;
      if (!assigneeActorId) {
        throw new TaskNotAssignedError(task.id);
      }

      const activeExecution = manager.create(ActiveTaskExecutionEntity, {
        taskId: task.id,
        claimedAt: new Date(),
        taskStatusBeforeClaim: task.status,
        taskTagsBeforeClaim: task.tags.map(
          (tag): ActiveTaskExecutionTagSnapshot => ({
            id: tag.id,
            name: tag.name,
          }),
        ),
        taskAssigneeActorIdBeforeClaim: assigneeActorId,
        agentActorId: assigneeActorId,
        workerClientId: input.workerClientId,
        lastHeartbeatAt: null,
        runnerSessionId: null,
        toolCallCount: 0,
      });

      const savedExecution = await manager.save(activeExecution);

      const hydratedExecution = await manager.findOne(ActiveTaskExecutionEntity, {
        where: { id: savedExecution.id },
        relations: ['task'],
      });

      if (!hydratedExecution) {
        throw new Error('Active task execution was created but could not be reloaded.');
      }

      return hydratedExecution;
    });

    this.executionActivityService.publishSystemActivity({
      executionId: execution.id,
      taskId: execution.taskId,
      agentActorId: execution.agentActorId,
      kind: 'execution.started',
      message: 'Execution started',
    });

    return execution;
  }

  async stopTask(
    input: StopTaskExecutionInput,
  ): Promise<TaskExecutionHistoryEntity> {
    const historyEntry = await this.dataSource.transaction(async (manager) => {
      const activeExecution = await manager.findOne(ActiveTaskExecutionEntity, {
        where: { id: input.executionId },
      });

      if (!activeExecution) {
        throw new ActiveTaskExecutionNotFoundError(input.executionId);
      }

      await manager.delete(ActiveTaskExecutionEntity, {
        id: activeExecution.id,
      });

      const historyEntry = manager.create(TaskExecutionHistoryEntity, {
        taskId: activeExecution.taskId,
        claimedAt: activeExecution.claimedAt,
        transitionedAt: new Date(),
        agentActorId: activeExecution.agentActorId,
        workerClientId: input.workerClientId,
        runnerSessionId: activeExecution.runnerSessionId,
        toolCallCount: activeExecution.toolCallCount,
        status: input.status,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      });

      const savedHistoryEntry = await manager.save(historyEntry);

      const hydratedHistoryEntry = await manager.findOne(
        TaskExecutionHistoryEntity,
        {
          where: { id: savedHistoryEntry.id },
          relations: ['task'],
        },
      );

      if (!hydratedHistoryEntry) {
        throw new Error(
          'Task execution history was created but could not be reloaded.',
        );
      }

      return hydratedHistoryEntry;
    });

    this.executionActivityService.publishSystemActivity({
      executionId: input.executionId,
      taskId: historyEntry.taskId,
      agentActorId: historyEntry.agentActorId,
      kind: 'execution.stopped',
      message: `Execution stopped (${historyEntry.status.toLowerCase()})`,
    });

    this.executionActivityService.publishSystemActivity({
      executionId: input.executionId,
      taskId: historyEntry.taskId,
      agentActorId: historyEntry.agentActorId,
      kind: 'execution.history.added',
      message: `Execution history recorded (${historyEntry.status.toLowerCase()})`,
    });

    return historyEntry;
  }

  async updateRunnerSessionId(input: UpdateRunnerSessionIdInput): Promise<void> {
    const result = await this.activeTaskExecutionRepository
      .createQueryBuilder()
      .update(ActiveTaskExecutionEntity)
      .set({
        runnerSessionId: input.runnerSessionId,
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId: input.executionId })
      .andWhere('runner_session_id IS NULL')
      .execute();

    if ((result.affected ?? 0) > 0) {
      return;
    }

    const existing = await this.activeTaskExecutionRepository.findOne({
      where: { id: input.executionId },
      select: { id: true },
    });

    if (!existing) {
      throw new ActiveTaskExecutionNotFoundError(input.executionId);
    }
  }

  async incrementToolCallCount(input: IncrementToolCallCountInput): Promise<void> {
    const result = await this.activeTaskExecutionRepository
      .createQueryBuilder()
      .update(ActiveTaskExecutionEntity)
      .set({
        toolCallCount: () => 'tool_call_count + 1',
        rowVersion: () => 'row_version + 1',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :executionId', { executionId: input.executionId })
      .execute();

    if ((result.affected ?? 0) === 0) {
      throw new ActiveTaskExecutionNotFoundError(input.executionId);
    }
  }
}
