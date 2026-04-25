import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionQueueEntity } from './task-execution-queue.entity';
import {
  TaskExecutionQueueEntryResult,
  TaskExecutionQueueListResult,
} from '../dto/service/execution-results.service.types';

@Injectable()
export class TaskExecutionQueueService {
  constructor(
    @InjectRepository(TaskExecutionQueueEntity)
    private readonly taskExecutionQueueRepository: Repository<TaskExecutionQueueEntity>,
  ) {}

  async listQueue(options?: {
    page?: number;
    limit?: number;
  }): Promise<TaskExecutionQueueListResult> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await this.taskExecutionQueueRepository.findAndCount({
      relations: ['task'],
      order: { taskId: 'ASC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((item) => this.mapQueueEntryToResult(item)),
      total,
      page,
      limit,
    };
  }

  private mapQueueEntryToResult(
    entry: TaskExecutionQueueEntity,
  ): TaskExecutionQueueEntryResult {
    return {
      taskId: entry.taskId,
      taskName: entry.task?.name ?? null,
      taskStatus: entry.task?.status ?? null,
    };
  }
}
