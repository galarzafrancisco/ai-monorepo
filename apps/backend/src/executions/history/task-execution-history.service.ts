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

  async listHistory(): Promise<TaskExecutionHistoryEntity[]> {
    return this.taskExecutionHistoryRepository.find({
      relations: ['task'],
      order: { taskId: 'ASC' },
    });
  }
}
