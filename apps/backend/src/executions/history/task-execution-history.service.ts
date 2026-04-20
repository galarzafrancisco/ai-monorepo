import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionHistoryEntity } from './task-execution-history.entity';

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
  }): Promise<{
    items: TaskExecutionHistoryEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
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

    return { items, total, page, limit };
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
}
