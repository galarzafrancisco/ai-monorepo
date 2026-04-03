import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveTaskExecutionEntity } from './active-task-execution.entity';

@Injectable()
export class ActiveTaskExecutionService {
  constructor(
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
  ) {}

  async listActiveExecutions(): Promise<ActiveTaskExecutionEntity[]> {
    return this.activeTaskExecutionRepository.find({
      relations: ['task'],
      order: { taskId: 'ASC' },
    });
  }
}
