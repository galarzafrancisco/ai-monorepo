import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
    return this.applyCandidateFilters(
      this.taskRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.tags', 'tag')
        .where('task.id = :taskId', { taskId }),
    ).getOne();
  }

  async listCandidateTasks(): Promise<TaskEntity[]> {
    return this.applyCandidateFilters(
      this.taskRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.tags', 'tag'),
    ).getMany();
  }

  private applyCandidateFilters(
    queryBuilder: SelectQueryBuilder<TaskEntity>,
  ): SelectQueryBuilder<TaskEntity> {
    return queryBuilder
      .leftJoin(
        ActiveTaskExecutionEntity,
        'activeExecution',
        'activeExecution.task_id = task.id',
      )
      .andWhere('task.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('task.assignee_actor_id IS NOT NULL')
      .andWhere('activeExecution.task_id IS NULL')
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_dependencies dependency
          INNER JOIN tasks prerequisite ON prerequisite.id = dependency.depends_on_task_id
          WHERE dependency.task_id = task.id
            AND prerequisite.deleted_at IS NULL
            AND prerequisite.status != :doneStatus
        )`,
      );
  }

  async countActiveExecutionsForAgent(agentActorId: string): Promise<number> {
    return this.activeTaskExecutionRepository
      .createQueryBuilder('execution')
      .where('execution.agent_actor_id = :agentActorId', { agentActorId })
      .getCount();
  }
}
