import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionHistoryEntity } from './task-execution-history.entity';
import {
  ExecutionStatsResult,
  TaskExecutionHistoryListResult,
  TaskExecutionHistoryResult,
} from '../dto/service/execution-results.service.types';
import { ExecutionStatsEntity } from '../stats/execution-stats.entity';

@Injectable()
export class TaskExecutionHistoryService {
  constructor(
    @InjectRepository(TaskExecutionHistoryEntity)
    private readonly taskExecutionHistoryRepository: Repository<TaskExecutionHistoryEntity>,
  ) {}

  async listHistory(options?: {
    page?: number;
    limit?: number;
    taskId?: string;
  }): Promise<TaskExecutionHistoryListResult> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = options?.taskId ? { taskId: options.taskId } : {};

    const [items, total] = await this.taskExecutionHistoryRepository.findAndCount({
      where,
      relations: ['task', 'stats'],
      order: { transitionedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((item) => this.mapHistoryEntryToResult(item)),
      total,
      page,
      limit,
    };
  }

  async getLatestHistoryForTask(
    taskId: string,
  ): Promise<TaskExecutionHistoryEntity | null> {
    return this.taskExecutionHistoryRepository.findOne({
      where: { taskId },
      relations: ['stats'],
      order: { transitionedAt: 'DESC' },
    });
  }

  async countConsecutiveQuotaErrors(taskId: string): Promise<number> {
    // Get all history entries for this task, ordered by time
    const histories = await this.taskExecutionHistoryRepository.find({
      where: { taskId },
      order: { transitionedAt: 'DESC' },
    });

    // Count consecutive quota errors from the most recent execution
    let count = 0;
    for (const history of histories) {
      if (
        history.status === 'FAILED' &&
        history.errorCode === 'OUT_OF_QUOTA'
      ) {
        count++;
      } else {
        break; // Stop at first non-quota error
      }
    }

    return count;
  }

  private mapHistoryEntryToResult(
    historyEntry: TaskExecutionHistoryEntity,
  ): TaskExecutionHistoryResult {
    return {
      id: historyEntry.id,
      taskId: historyEntry.taskId,
      taskName: historyEntry.task?.name ?? null,
      taskStatus: historyEntry.task?.status ?? null,
      claimedAt: historyEntry.claimedAt,
      transitionedAt: historyEntry.transitionedAt,
      agentActorId: historyEntry.agentActorId,
      workerClientId: historyEntry.workerClientId,
      runnerSessionId: historyEntry.runnerSessionId,
      toolCallCount: historyEntry.toolCallCount,
      status: historyEntry.status,
      errorCode: historyEntry.errorCode,
      errorMessage: historyEntry.errorMessage,
      stats: historyEntry.stats ? this.mapStatsToResult(historyEntry.stats) : null,
    };
  }

  private mapStatsToResult(stats: ExecutionStatsEntity): ExecutionStatsResult {
    return {
      harness: stats.harness,
      providerId: stats.providerId,
      modelId: stats.modelId,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      totalTokens: stats.totalTokens,
    };
  }
}
