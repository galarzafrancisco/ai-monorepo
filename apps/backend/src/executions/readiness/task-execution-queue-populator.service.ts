import { Injectable, Logger } from '@nestjs/common';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { AgentResult } from '../../agents/dto/service/agents.service.types';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import { ReadinessCandidateRepository } from './readiness-candidate.repository';
import { TaskExecutionQueuedEvent } from '../queue/task-execution-queued.event';

@Injectable()
export class TaskExecutionQueuePopulatorService {
  private readonly logger = new Logger(TaskExecutionQueuePopulatorService.name);

  constructor(
    @InjectRepository(TaskExecutionQueueEntity)
    private readonly taskExecutionQueueRepository: Repository<TaskExecutionQueueEntity>,
    private readonly agentsService: AgentsService,
    private readonly readinessCandidateRepository: ReadinessCandidateRepository,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async populateTask(taskId: string): Promise<void> {
    const task = await this.readinessCandidateRepository.findCandidateTaskById(
      taskId,
    );
    if (!task) {
      this.logger.debug(`Task ${taskId} is not a readiness candidate; removing queue entry`);
      await this.deleteQueueEntry(taskId);
      return;
    }

    await this.reconcileTask(task);
  }

  async populateAllTasks(): Promise<void> {
    const tasks = await this.readinessCandidateRepository.listCandidateTasks();
    this.logger.debug(`Reconciling queue eligibility for ${tasks.length} candidate tasks`);

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
      this.logger.debug(`Queueing task ${task.id} (${task.name})`);
      await this.upsertQueueEntry(task.id);
      this.eventEmitter.emit(
        TaskExecutionQueuedEvent.INTERNAL,
        new TaskExecutionQueuedEvent(task.id),
      );
      return;
    }

    this.logger.debug(`Not queueing task ${task.id} (${task.name})`);
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
      this.logger.debug(
        `Task ${task.id} is not queueable: no active agent for actor ${task.assigneeActorId}`,
      );
      return false;
    }

    if (!agent.statusTriggers.includes(task.status)) {
      this.logger.debug(
        `Task ${task.id} is not queueable: agent ${agent.slug} does not react to status ${task.status}`,
      );
      return false;
    }

    if (!this.matchesTagTriggers(task, agent)) {
      this.logger.debug(
        `Task ${task.id} is not queueable: task tags do not satisfy agent ${agent.slug} tag triggers`,
      );
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
      this.logger.debug(
        `Task ${task.id} is not queueable: agent ${agent.slug} is at concurrency limit ${agent.concurrencyLimit}`,
      );
      return false;
    }

    return true;
  }

  private matchesTagTriggers(task: TaskEntity, agent: AgentResult): boolean {
    if (agent.tagTriggers.length === 0) {
      return true; // no tags triggers means it reacts to all tags
    }

    const taskTagNames = new Set(task.tags.map((tag) => tag.name));
    return agent.tagTriggers.every((tagTrigger) => taskTagNames.has(tagTrigger));
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
