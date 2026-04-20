import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionQueueEntity } from './task-execution-queue.entity';

@Injectable()
export class TaskExecutionQueueService {
  constructor(
    @InjectRepository(TaskExecutionQueueEntity)
    private readonly taskExecutionQueueRepository: Repository<TaskExecutionQueueEntity>,
  ) {}

  async listQueue(options?: {
    page?: number;
    limit?: number;
  }): Promise<{
    items: TaskExecutionQueueEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await this.taskExecutionQueueRepository.findAndCount({
      relations: ['task'],
      order: { taskId: 'ASC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }
}
