import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { TaskExecutionEntity } from './task-execution.entity';
import { TaskExecutionStatus } from './enums';
import { TaskEntity } from '../tasks/task.entity';
import { ActorType } from '../identity-provider/enums';
import { TaskStatus } from '../tasks/enums';
import { AgentEntity } from '../agents/agent.entity';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskStatusChangedEvent,
  InputRequestAnsweredEvent,
} from '../tasks/events/tasks.events';
import {
  ExecutionCreatedEvent,
  ExecutionUpdatedEvent,
  ExecutionDeletedEvent,
} from './events/executions.events';

/**
 * ExecutionReconcilerService
 *
 * Listens to task domain events and maintains TaskExecution state in response.
 * This service implements the backend-driven execution eligibility model where
 * the backend (not the worker) determines which tasks are ready to run.
 *
 * Eligibility criteria:
 * - Task must be assigned to an agent actor (not human)
 * - Task status must match one of the agent's statusTriggers
 * - Task must have at least one tag matching agent's tagTriggers (if agent has tagTriggers configured)
 * - All dependency tasks (dependsOn) must be DONE
 * - No blocking input requests (all must be answered or none exist)
 * - Task must not be in DONE status (performance optimization - avoid reconciling completed tasks)
 *
 * When a task becomes eligible, a TaskExecution row is created/updated to READY status.
 * When a task is no longer eligible, its TaskExecution is cancelled.
 * When a task completes, all dependent tasks are reevaluated (dependency fan-out).
 */
@Injectable()
export class ExecutionReconcilerService {
  private readonly logger = new Logger(ExecutionReconcilerService.name);

  constructor(
    @InjectRepository(TaskExecutionEntity)
    private readonly executionRepository: Repository<TaskExecutionEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle task created event.
   * New tasks start as NOT_STARTED and typically won't be eligible yet,
   * but we reconcile anyway in case they were created with IN_PROGRESS status.
   */
  @OnEvent(TaskCreatedEvent.INTERNAL)
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    this.logger.debug({
      message: 'Task created event received',
      taskId: event.payload.id,
    });

    await this.reconcileTask(event.payload.id);
  }

  /**
   * Handle task updated event.
   * Dependencies or other properties may have changed.
   */
  @OnEvent(TaskUpdatedEvent.INTERNAL)
  async onTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    this.logger.debug({
      message: 'Task updated event received',
      taskId: event.payload.id,
    });

    await this.reconcileTask(event.payload.id);
  }

  /**
   * Handle task assigned event.
   * Assignment changes eligibility (must be assigned to an agent).
   */
  @OnEvent(TaskAssignedEvent.INTERNAL)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    this.logger.debug({
      message: 'Task assigned event received',
      taskId: event.payload.id,
      assigneeActorId: event.payload.assigneeActorId,
    });

    await this.reconcileTask(event.payload.id);
  }

  /**
   * Handle task status changed event.
   * Status is a key eligibility criterion.
   * When a task moves to DONE, we need to reevaluate all dependent tasks (fan-out).
   */
  @OnEvent(TaskStatusChangedEvent.INTERNAL)
  async onTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    this.logger.debug({
      message: 'Task status changed event received',
      taskId: event.payload.id,
      status: event.payload.status,
    });

    await this.reconcileTask(event.payload.id);

    // If task moved to DONE, trigger dependency fan-out
    if (event.payload.status === TaskStatus.DONE) {
      await this.reconcileDependentTasks(event.payload.id);
    }
  }

  /**
   * Handle input request answered event.
   * Input requests block execution when unanswered.
   */
  @OnEvent(InputRequestAnsweredEvent.INTERNAL)
  async onInputRequestAnswered(
    event: InputRequestAnsweredEvent,
  ): Promise<void> {
    this.logger.debug({
      message: 'Input request answered event received',
      inputRequestId: event.payload.id,
      taskId: event.payload.taskId,
    });

    await this.reconcileTask(event.payload.taskId);
  }

  /**
   * Reconcile a single task's execution eligibility.
   * This is the core eligibility computation and upsert/cancel logic.
   */
  private async reconcileTask(taskId: string): Promise<void> {
    try {
      // Load task with all relations needed for eligibility check
      const task = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: ['assigneeActor', 'dependsOn', 'inputRequests', 'tags'],
      });

      if (!task) {
        this.logger.warn({
          message: 'Task not found during reconciliation',
          taskId,
        });
        return;
      }

      // Performance optimization: skip reconciling DONE tasks
      // But first, cancel any READY executions since DONE tasks are never eligible
      if (task.status === TaskStatus.DONE) {
        await this.cancelExecution(
          task,
          'Task is in DONE status and no longer eligible for execution',
        );
        this.logger.debug({
          message: 'Cancelled READY executions for DONE task',
          taskId,
        });
        return;
      }

      const eligibility = await this.computeEligibility(task);

      if (eligibility.eligible) {
        await this.upsertExecution(task, eligibility.reason);
      } else {
        await this.cancelExecution(task, eligibility.reason);
      }
    } catch (error) {
      this.logger.error({
        message: 'Error reconciling task',
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Reconcile all tasks that depend on the given task.
   * Called when a prerequisite task completes.
   */
  private async reconcileDependentTasks(taskId: string): Promise<void> {
    try {
      // Find all tasks that depend on this task
      const dependentTasks = await this.taskRepository
        .createQueryBuilder('task')
        .innerJoin('task.dependsOn', 'dependency')
        .where('dependency.id = :taskId', { taskId })
        .getMany();

      this.logger.debug({
        message: 'Reconciling dependent tasks after prerequisite completion',
        prerequisiteTaskId: taskId,
        dependentTaskCount: dependentTasks.length,
      });

      // Reconcile each dependent task
      for (const dependentTask of dependentTasks) {
        await this.reconcileTask(dependentTask.id);
      }
    } catch (error) {
      this.logger.error({
        message: 'Error reconciling dependent tasks',
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Compute whether a task is eligible for execution.
   * Returns { eligible: boolean, reason: string }.
   */
  private async computeEligibility(
    task: TaskEntity,
  ): Promise<{ eligible: boolean; reason: string }> {
    // Must be assigned
    if (!task.assigneeActorId) {
      return {
        eligible: false,
        reason: 'Task is not assigned',
      };
    }

    // Must be assigned to an agent actor (not human)
    const assignee = task.assigneeActor;
    if (!assignee || assignee.type !== ActorType.AGENT) {
      return {
        eligible: false,
        reason: 'Task is not assigned to an agent',
      };
    }

    // Load the agent configuration to check trigger conditions
    const agent = await this.agentRepository.findOne({
      where: { actorId: task.assigneeActorId },
    });

    if (!agent) {
      return {
        eligible: false,
        reason: 'Agent configuration not found',
      };
    }

    // Agent must be active
    if (!agent.isActive) {
      return {
        eligible: false,
        reason: 'Agent is not active',
      };
    }

    // Task status must match one of the agent's statusTriggers
    if (
      !agent.statusTriggers ||
      agent.statusTriggers.length === 0 ||
      !agent.statusTriggers.includes(task.status)
    ) {
      return {
        eligible: false,
        reason: `Task status ${task.status} does not match agent's statusTriggers: [${agent.statusTriggers.join(', ')}]`,
      };
    }

    // If agent has tagTriggers configured, task must have at least one matching tag
    if (agent.tagTriggers && agent.tagTriggers.length > 0) {
      const taskTagNames = task.tags?.map((tag) => tag.name) || [];
      const hasMatchingTag = agent.tagTriggers.some((triggerTag) =>
        taskTagNames.includes(triggerTag),
      );

      if (!hasMatchingTag) {
        return {
          eligible: false,
          reason: `Task tags [${taskTagNames.join(', ')}] do not match agent's tagTriggers: [${agent.tagTriggers.join(', ')}]`,
        };
      }
    }

    // All dependencies must be DONE
    if (task.dependsOn && task.dependsOn.length > 0) {
      const incompleteDeps = task.dependsOn.filter(
        (dep) => dep.status !== TaskStatus.DONE,
      );
      if (incompleteDeps.length > 0) {
        return {
          eligible: false,
          reason: `${incompleteDeps.length} dependency task(s) not yet DONE`,
        };
      }
    }

    // No blocking input requests (all must be answered)
    if (task.inputRequests && task.inputRequests.length > 0) {
      const unansweredRequests = task.inputRequests.filter(
        (req) => req.answer === null,
      );
      if (unansweredRequests.length > 0) {
        return {
          eligible: false,
          reason: `${unansweredRequests.length} unanswered input request(s)`,
        };
      }
    }

    return {
      eligible: true,
      reason: 'Task is eligible for execution',
    };
  }

  /**
   * Create or update a TaskExecution to READY status.
   * Uses upsert pattern to handle both new and existing executions.
   */
  private async upsertExecution(
    task: TaskEntity,
    reason: string,
  ): Promise<void> {
    // Check if execution already exists for this task + agent
    const existingExecution = await this.executionRepository.findOne({
      where: {
        taskId: task.id,
        agentActorId: task.assigneeActorId!,
      },
    });

    if (existingExecution) {
      // Only update if not already in a terminal or active state
      if (
        existingExecution.status === TaskExecutionStatus.READY ||
        existingExecution.status === TaskExecutionStatus.CANCELLED
      ) {
        // Already READY or was CANCELLED, ensure it's READY
        if (existingExecution.status !== TaskExecutionStatus.READY) {
          existingExecution.status = TaskExecutionStatus.READY;
          existingExecution.triggerReason = reason;
          existingExecution.requestedAt = new Date();
          const savedExecution = await this.executionRepository.save(existingExecution);

          // Load execution with relations for event payload
          const executionWithRelations = await this.executionRepository.findOne({
            where: { id: savedExecution.id },
            relations: ['task', 'agentActor'],
          });

          if (executionWithRelations) {
            this.eventEmitter.emit(
              ExecutionUpdatedEvent.INTERNAL,
              new ExecutionUpdatedEvent(
                { id: 'system' },
                executionWithRelations,
              ),
            );
          }

          this.logger.log({
            message: 'TaskExecution updated to READY',
            executionId: existingExecution.id,
            taskId: task.id,
            reason,
          });
        }
      } else {
        // Active execution (CLAIMED, RUNNING, STOP_REQUESTED) or terminal (COMPLETED, FAILED, STALE)
        // Don't interfere with active/terminal executions
        this.logger.debug({
          message: 'TaskExecution already exists in non-updatable state',
          executionId: existingExecution.id,
          taskId: task.id,
          status: existingExecution.status,
        });
      }
    } else {
      // Create new execution
      const execution = this.executionRepository.create({
        taskId: task.id,
        agentActorId: task.assigneeActorId!,
        status: TaskExecutionStatus.READY,
        requestedAt: new Date(),
        triggerReason: reason,
      });

      const savedExecution = await this.executionRepository.save(execution);

      // Load execution with relations for event payload
      const executionWithRelations = await this.executionRepository.findOne({
        where: { id: savedExecution.id },
        relations: ['task', 'agentActor'],
      });

      if (executionWithRelations) {
        this.eventEmitter.emit(
          ExecutionCreatedEvent.INTERNAL,
          new ExecutionCreatedEvent(
            { id: 'system' },
            executionWithRelations,
          ),
        );
      }

      this.logger.log({
        message: 'TaskExecution created',
        executionId: execution.id,
        taskId: task.id,
        agentActorId: task.assigneeActorId!,
        reason,
      });
    }
  }

  /**
   * Cancel any READY TaskExecution for this task.
   * Does not cancel already-running executions.
   */
  private async cancelExecution(task: TaskEntity, reason: string): Promise<void> {
    const executions = await this.executionRepository.find({
      where: {
        taskId: task.id,
        status: TaskExecutionStatus.READY,
      },
    });

    for (const execution of executions) {
      execution.status = TaskExecutionStatus.CANCELLED;
      execution.failureReason = reason;
      const savedExecution = await this.executionRepository.save(execution);

      // Load execution with relations for event payload
      const executionWithRelations = await this.executionRepository.findOne({
        where: { id: savedExecution.id },
        relations: ['task', 'agentActor'],
      });

      if (executionWithRelations) {
        this.eventEmitter.emit(
          ExecutionUpdatedEvent.INTERNAL,
          new ExecutionUpdatedEvent(
            { id: 'system' },
            executionWithRelations,
          ),
        );
      }

      this.logger.log({
        message: 'TaskExecution cancelled',
        executionId: execution.id,
        taskId: task.id,
        reason,
      });
    }
  }
}
