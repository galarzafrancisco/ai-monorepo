import { Injectable, Logger } from '@nestjs/common';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AgentsService } from '../../agents/agents.service';
import { AgentResult } from '../../agents/dto/service/agents.service.types';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import { ReadinessCandidateRepository } from './readiness-candidate.repository';

@Injectable()
export class TaskExecutionQueuePopulatorService {
  private readonly logger = new Logger(TaskExecutionQueuePopulatorService.name);

  constructor(
    @InjectRepository(TaskExecutionQueueEntity)
    private readonly taskExecutionQueueRepository: Repository<TaskExecutionQueueEntity>,
    private readonly agentsService: AgentsService,
    private readonly readinessCandidateRepository: ReadinessCandidateRepository,
  ) {}

  async populateTask(taskId: string): Promise<void> {
    const task = await this.readinessCandidateRepository.findCandidateTaskById(
      taskId,
    );
    this.logger.debug(task);
    this.logger.debug("A");
    if (!task) {
      await this.deleteQueueEntry(taskId);
      return;
    }
    this.logger.debug("B");

    await this.reconcileTask(task);
  }

  async populateAllTasks(): Promise<void> {
    const tasks = await this.readinessCandidateRepository.listCandidateTasks();
    this.logger.debug("CANDIDATE TASKS");
    this.logger.debug(tasks);

    const agentsByActorId = await this.loadAgentsByActorId(tasks);

    for (const task of tasks) {
      await this.reconcileTask(task, agentsByActorId);
    }

    const taskIds = tasks.map((task) => task.id);
    if (taskIds.length === 0) {
      await this.taskExecutionQueueRepository.clear();
      return;
    }

    await this.taskExecutionQueueRepository.delete({
      taskId: Not(In(taskIds)),
    });
  }

  private async reconcileTask(
    task: TaskEntity,
    agentsByActorId?: Map<string, AgentResult>,
  ): Promise<void> {
    this.logger.debug(`RECONCILING TASK "${task.name}"`)
    const shouldBeQueued = await this.shouldQueueTask(task, agentsByActorId);
    this.logger.debug(`should it be queued? ${shouldBeQueued}`);
    if (shouldBeQueued) {
      await this.upsertQueueEntry(task.id);
      return;
    }

    await this.deleteQueueEntry(task.id);
  }

  private async shouldQueueTask(
    task: TaskEntity,
    agentsByActorId?: Map<string, AgentResult>,
  ): Promise<boolean> {
    this.logger.debug(`checking if task should be queued...`);
    const agent =
      agentsByActorId?.get(task.assigneeActorId!) ??
      (
        await this.agentsService.getActiveAgentsByActorIds({
          actorIds: [task.assigneeActorId!],
        })
      )[0];

    if (!agent) {
      this.logger.debug(`couldn't find agent "${task.assigneeActorId}"`);
      return false;
    }

    if (!agent.statusTriggers.includes(task.status)) {
      this.logger.debug(`agent ${agent.slug} does not react to status ${task.status}`);
      return false;
    }

    if (!this.matchesTagTriggers(task, agent)) {
      this.logger.debug(`agent ${agent.slug} tags trigger don't match tasks tags.`)
      return false;
    }

    const agentActiveExecutionCount =
      await this.readinessCandidateRepository.countActiveExecutionsForAgent(
        agent.actorId,
      );

    if (
      agent.concurrencyLimit !== null &&
      agentActiveExecutionCount >= agent.concurrencyLimit
    ) {
      return false;
    }

    return true;
  }

  private matchesTagTriggers(task: TaskEntity, agent: AgentResult): boolean {
    if (agent.tagTriggers.length === 0) {
      return true; // no tags triggers means it reacts to all tags
    }

    const taskTagNames = new Set(task.tags.map((tag) => tag.name));
    return agent.tagTriggers.some((tagTrigger) => taskTagNames.has(tagTrigger));
  }

  private async loadAgentsByActorId(
    tasks: TaskEntity[],
  ): Promise<Map<string, AgentResult>> {
    const assigneeActorIds = [
      ...new Set(
        tasks
          .map((task) => task.assigneeActorId)
          .filter((assigneeActorId): assigneeActorId is string =>
            assigneeActorId !== null,
          ),
      ),
    ];

    if (assigneeActorIds.length === 0) {
      return new Map();
    }

    const agents = await this.agentsService.getActiveAgentsByActorIds({
      actorIds: assigneeActorIds,
    });

    return new Map(agents.map((agent) => [agent.actorId, agent]));
  }

  private async upsertQueueEntry(taskId: string): Promise<void> {
    await this.taskExecutionQueueRepository
      .createQueryBuilder()
      .insert()
      .into(TaskExecutionQueueEntity)
      .values({ taskId })
      .orIgnore()
      .execute();
  }

  private async deleteQueueEntry(taskId: string): Promise<void> {
    await this.taskExecutionQueueRepository.delete({ taskId });
  }
}
