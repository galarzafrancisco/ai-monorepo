import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../agents/agent.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { User } from '../identity-provider/user.entity';
import { UserNotFoundError } from '../identity-provider/errors/identity-provider.errors';
import { ProjectEntity } from '../meta/project.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ThreadEntity } from '../threads/thread.entity';
import { WorkerEntity } from '../workers/worker.entity';

export type OnboardingStatusResult = {
  workerConfigured: boolean;
  agentCreated: boolean;
  taskCreated: boolean;
  projectCreated: boolean;
  contextBlockCreated: boolean;
  threadConfigured: boolean;
  taskWithProjectCreated: boolean;
  onboardingDisplayMode: User['onboardingDisplayMode'];
};

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(WorkerEntity)
    private readonly workersRepository: Repository<WorkerEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentsRepository: Repository<AgentEntity>,
    @InjectRepository(TaskEntity)
    private readonly tasksRepository: Repository<TaskEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    @InjectRepository(ContextBlockEntity)
    private readonly contextBlocksRepository: Repository<ContextBlockEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadsRepository: Repository<ThreadEntity>,
  ) {}

  async getStatusForActor(actorId: string): Promise<OnboardingStatusResult> {
    const user = await this.usersRepository.findOne({ where: { actorId } });

    if (!user) {
      throw new UserNotFoundError(actorId);
    }

    const [
      workerConfigured,
      agentCreated,
      taskCreated,
      projectCreated,
      contextBlockCreated,
      threadConfigured,
      taskWithProjectCreated,
    ] = await Promise.all([
      this.workersRepository.existsBy({}),
      this.agentsRepository.existsBy({}),
      this.tasksRepository.existsBy({ createdByActorId: actorId }),
      this.projectsRepository.existsBy({}),
      this.contextBlocksRepository.existsBy({ createdByActorId: actorId }),
      this.threadsRepository.existsBy({ createdByActorId: actorId }),
      this.tasksRepository
        .createQueryBuilder('task')
        .innerJoin('task.tags', 'tag')
        .innerJoin(ProjectEntity, 'project', 'project.tagId = tag.id')
        .where('task.createdByActorId = :actorId', { actorId })
        .getExists(),
    ]);

    return {
      workerConfigured,
      agentCreated,
      taskCreated,
      projectCreated,
      contextBlockCreated,
      threadConfigured,
      taskWithProjectCreated,
      onboardingDisplayMode: user.onboardingDisplayMode,
    };
  }
}
