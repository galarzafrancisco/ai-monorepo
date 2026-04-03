import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskStatus } from '../../tasks/enums';
import { TaskEntity } from '../../tasks/task.entity';
import { ActiveTaskExecutionEntity } from '../active/active-task-execution.entity';

@Injectable()
export class ReadinessCandidateRepository {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
  ) {}

  async findCandidateTaskById(taskId: string): Promise<TaskEntity | null> {
    return this.taskRepository
      .createQueryBuilder('task')
      .leftJoin(
        ActiveTaskExecutionEntity,
        'activeExecution',
        'activeExecution.task_id = task.id',
      )
      .leftJoinAndSelect('task.tags', 'tag')
      .where('task.id = :taskId', { taskId })
      .andWhere('task.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('task.assignee_actor_id IS NOT NULL')
      .andWhere('activeExecution.task_id IS NULL')
      .getOne();
  }

  async listCandidateTasks(): Promise<TaskEntity[]> {
    return this.taskRepository
      .createQueryBuilder('task')
      .leftJoin(
        ActiveTaskExecutionEntity,
        'activeExecution',
        'activeExecution.task_id = task.id',
      )
      .leftJoinAndSelect('task.tags', 'tag')
      .where('task.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('task.assignee_actor_id IS NOT NULL')
      .andWhere('activeExecution.task_id IS NULL')
      .getMany();
  }

  async countActiveExecutionsForAgent(agentActorId: string): Promise<number> {
    return this.activeTaskExecutionRepository
      .createQueryBuilder('execution')
      .where('execution.agent_actor_id = :agentActorId', { agentActorId })
      .getCount();
  }
}
