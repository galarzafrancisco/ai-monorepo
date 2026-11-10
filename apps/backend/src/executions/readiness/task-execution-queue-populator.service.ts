import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { AgentResult } from '../../agents/dto/service/agents.service.types';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import { ReadinessCandidateRepository } from './readiness-candidate.repository';
import { TaskExecutionQueuedEvent } from '../queue/task-execution-queued.event';
import { TaskExecutionHistoryService } from '../history/task-execution-history.service';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';
import { TaskExecutionHistoryErrorCode } from '../history/task-execution-history-error-code.enum';
import { lockAgentSlots } from '../agent-slots';

/**
 * Keeps the queue in step with what is ready to run. Runs across every
 * workspace (it starts from tasks, not a request); a task is only matched to
 * an agent of its own workspace, and its queue entry is in that workspace.
 */
@Injectable()
export class TaskExecutionQueuePopulatorService {
  private readonly logger = new Logger(TaskExecutionQueuePopulatorService.name);

  constructor(
    @InjectRepository(TaskExecutionQueueEntity)
    private readonly taskExecutionQueueRepository: Repository<TaskExecutionQueueEntity>,
    private readonly agentsService: AgentsService,
    private readonly readinessCandidateRepository: ReadinessCandidateRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly taskExecutionHistoryService: TaskExecutionHistoryService,
    private readonly dataSource: DataSource,
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
    const agent = await this.eligibleAgent(task, agentsByActorId);
    const queued = agent ? await this.queueIfAgentHasSlot(task, agent) : false;

    if (queued) {
      this.logger.debug(`Queueing task ${task.id} (${task.name})`);
      this.eventEmitter.emit(
        TaskExecutionQueuedEvent.INTERNAL,
        new TaskExecutionQueuedEvent(task.workspaceId, task.id),
      );
      return;
    }

    this.logger.debug(`Not queueing task ${task.id} (${task.name})`);
    if (!agent) {
      await this.deleteQueueEntry(task.id);
    }
  }

  /** The agent that should run the task now, slots aside; null if none. */
  private async eligibleAgent(
    task: TaskEntity,
    agentsByActorId?: Map<string, AgentResult>,
  ): Promise<AgentResult | null> {
    const agent = agentsByActorId
      ? agentsByActorId.get(agentKey(task.workspaceId, task.assigneeActorId!))
      : (
          await this.agentsService.getActiveAgentsByActorIds(task.workspaceId, {
            actorIds: [task.assigneeActorId!],
          })
        )[0];

    if (!agent) {
      this.logger.debug(
        `Task ${task.id} is not queueable: no active agent for actor ${task.assigneeActorId}`,
      );
      return null;
    }

    if (!agent.statusTriggers.includes(task.status)) {
      this.logger.debug(
        `Task ${task.id} is not queueable: agent ${agent.slug} does not react to status ${task.status}`,
      );
      return null;
    }

    if (!this.matchesTagTriggers(task, agent)) {
      this.logger.debug(
        `Task ${task.id} is not queueable: task tags do not satisfy agent ${agent.slug} tag triggers`,
      );
      return null;
    }

    // Check if task should be delayed due to recent errors or cancellation
    if (await this.shouldDelayTask(task.workspaceId, task.id)) {
      return null;
    }

    return agent;
  }

  /**
   * Queues the task if its agent has a free slot, else takes it out of the
   * queue. Running and already-queued tasks both take a slot (counting only
   * the running ones let one sweep queue every waiting task), and the count
   * and insert run under the agent's slot lock, so two tasks reconciled at
   * once can't both see the last free slot.
   */
  private async queueIfAgentHasSlot(task: TaskEntity, agent: AgentResult): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      if (agent.concurrencyLimit !== null) {
        await lockAgentSlots(manager, agent.actorId);
        const slotsTaken = await this.readinessCandidateRepository.countSlotsTakenForAgent(
          manager,
          task.workspaceId,
          agent.actorId,
          task.id,
        );
        if (slotsTaken >= agent.concurrencyLimit) {
          this.logger.debug(
            `Task ${task.id} is not queueable: agent ${agent.slug} is at concurrency limit ${agent.concurrencyLimit}`,
          );
          await manager.delete(TaskExecutionQueueEntity, { taskId: task.id });
          return false;
        }
      }
      await manager
        .createQueryBuilder()
        .insert()
        .into(TaskExecutionQueueEntity)
        .values({ workspaceId: task.workspaceId, taskId: task.id })
        .orIgnore()
        .execute();
      return true;
    });
  }

  private async shouldDelayTask(
    workspaceId: string,
    taskId: string,
  ): Promise<boolean> {
    const latestHistory =
      await this.taskExecutionHistoryService.getLatestHistoryForTask(
        workspaceId,
        taskId,
      );

    if (!latestHistory) {
      return false; // No history, no delay needed
    }

    const now = new Date();
    const timeSinceLastExecution =
      now.getTime() - latestHistory.transitionedAt.getTime();

    // Check if task was cancelled
    if (latestHistory.status === TaskExecutionHistoryStatus.CANCELLED) {
      const delayMs = 10 * 60 * 1000; // 10 minutes
      if (timeSinceLastExecution < delayMs) {
        const remainingMs = delayMs - timeSinceLastExecution;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        this.logger.debug(
          `Task ${taskId} is not queueable: cancelled ${Math.floor(timeSinceLastExecution / 60000)} minutes ago, waiting ${remainingMinutes} more minutes`,
        );
        return true;
      }
    }

    // Check if task failed with OUT_OF_QUOTA error
    if (
      latestHistory.status === TaskExecutionHistoryStatus.FAILED &&
      latestHistory.errorCode === TaskExecutionHistoryErrorCode.OUT_OF_QUOTA
    ) {
      const quotaErrorCount =
        await this.taskExecutionHistoryService.countConsecutiveQuotaErrors(
          workspaceId,
          taskId,
        );

      const baseDelayMs = 10 * 60 * 1000; // 10 minutes
      const maxDelayMs = 60 * 60 * 1000; // 1 hour
      const delayMs = Math.min(baseDelayMs * quotaErrorCount, maxDelayMs);

      if (timeSinceLastExecution < delayMs) {
        const remainingMs = delayMs - timeSinceLastExecution;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        this.logger.debug(
          `Task ${taskId} is not queueable: has ${quotaErrorCount} consecutive quota errors, waiting ${remainingMinutes} more minutes`,
        );
        return true;
      }
    }

    return false;
  }

  private matchesTagTriggers(task: TaskEntity, agent: AgentResult): boolean {
    if (agent.tagTriggers.length === 0) {
      return true; // no tags triggers means it reacts to all tags
    }

    const taskTagNames = new Set(task.tags.map((tag) => tag.name));
    return agent.tagTriggers.every((tagTrigger) => taskTagNames.has(tagTrigger));
  }

  /** Active agents assigned to the tasks, keyed by `agentKey` (each looked up in its task's workspace). */
  private async loadAgentsByActorId(
    tasks: TaskEntity[],
  ): Promise<Map<string, AgentResult>> {
    const actorIdsByWorkspace = new Map<string, Set<string>>();
    for (const task of tasks) {
      if (task.assigneeActorId === null) continue;
      const actorIds = actorIdsByWorkspace.get(task.workspaceId) ?? new Set<string>();
      actorIds.add(task.assigneeActorId);
      actorIdsByWorkspace.set(task.workspaceId, actorIds);
    }

    const agentsByKey = new Map<string, AgentResult>();
    for (const [workspaceId, actorIds] of actorIdsByWorkspace) {
      const agents = await this.agentsService.getActiveAgentsByActorIds(workspaceId, {
        actorIds: [...actorIds],
      });
      for (const agent of agents) {
        agentsByKey.set(agentKey(workspaceId, agent.actorId), agent);
      }
    }
    return agentsByKey;
  }

  private async deleteQueueEntry(taskId: string): Promise<void> {
    await this.taskExecutionQueueRepository.delete({ taskId });
  }
}

function agentKey(workspaceId: string, actorId: string): string {
  return `${workspaceId}:${actorId}`;
}
