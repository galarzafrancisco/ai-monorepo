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

  async listQueue(): Promise<TaskExecutionQueueEntity[]> {
    return this.taskExecutionQueueRepository.find({
      relations: ['task'],
      order: { taskId: 'ASC' },
    });
  }
}
