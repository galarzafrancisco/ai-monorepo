import { Injectable } from '@nestjs/common';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AgentsService } from '../../agents/agents.service';
import { AgentResult } from '../../agents/dto/service/agents.service.types';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import { ReadinessCandidateRepository } from './readiness-candidate.repository';

@Injectable()
export class TaskExecutionQueuePopulatorService {
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

    if (!task) {
      await this.deleteQueueEntry(taskId);
      return;
    }

    await this.reconcileTask(task);
  }

  async populateAllTasks(): Promise<void> {
    const tasks = await this.readinessCandidateRepository.listCandidateTasks();

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
    const shouldBeQueued = await this.shouldQueueTask(task, agentsByActorId);

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
    const agent =
      agentsByActorId?.get(task.assigneeActorId!) ??
      (
        await this.agentsService.getActiveAgentsByActorIds({
          actorIds: [task.assigneeActorId!],
        })
      )[0];

    if (!agent) {
      return false;
    }

    if (!agent.statusTriggers.includes(task.status)) {
      return false;
    }

    if (!this.matchesTagTriggers(task, agent)) {
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
    const normalizedTagTriggers = new Set(
      agent.tagTriggers
        .map((tagTrigger) => this.normalizeTag(tagTrigger))
        .filter((tagTrigger): tagTrigger is string => tagTrigger.length > 0),
    );

    if (normalizedTagTriggers.size === 0) {
      return true; // no tags triggers means it reacts to all tags
    }

    const taskTagNames = new Set(
      task.tags
        .map((tag) => this.normalizeTag(tag.name))
        .filter((tagName): tagName is string => tagName.length > 0),
    );

    return [...normalizedTagTriggers].some((tagTrigger) =>
      taskTagNames.has(tagTrigger),
    );
  }

  private normalizeTag(tag: string): string {
    return tag.trim().toLowerCase();
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
