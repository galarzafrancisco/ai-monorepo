import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  InputRequestAnsweredEvent,
  TaskAssignedEvent,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskUpdatedEvent,
} from '../../tasks/events/tasks.events';
import { TaskExecutionQueuePopulatorService } from './task-execution-queue-populator.service';
import { ActiveExecutionsChangedEvent } from '../events/active-executions-changed.event';

@Injectable()
export class TaskEligibilityEventSourceService {
  private readonly logger = new Logger(TaskEligibilityEventSourceService.name);

  constructor(
    private readonly taskExecutionQueuePopulatorService: TaskExecutionQueuePopulatorService,
  ) {}

  @OnEvent(TaskCreatedEvent.INTERNAL)
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    await this.reconcileTask(event.payload.id, 'task_created');
  }

  @OnEvent(TaskUpdatedEvent.INTERNAL)
  async onTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    await this.reconcileTask(event.payload.id, 'task_updated');
  }

  @OnEvent(TaskAssignedEvent.INTERNAL)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    await this.reconcileTask(event.payload.id, 'task_assigned');
  }

  @OnEvent(TaskStatusChangedEvent.INTERNAL)
  async onTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    await this.reconcileTask(event.payload.id, 'task_status_changed');
  }

  @OnEvent(InputRequestAnsweredEvent.INTERNAL)
  async onInputRequestAnswered(
    event: InputRequestAnsweredEvent,
  ): Promise<void> {
    await this.reconcileTask(event.payload.taskId, 'input_request_answered');
  }

  /**
   * An execution started or ended (claim, stop, unclaim, prune), so an
   * agent's slot may be free: re-check waiting tasks now instead of at the
   * next minute's sweep. Bursts are coalesced into one run, and runs never
   * overlap.
   */
  @OnEvent(ActiveExecutionsChangedEvent.INTERNAL)
  onActiveExecutionsChanged(): void {
    if (this.sweepPending) return;
    this.sweepPending = true;
    setTimeout(() => void this.sweepAfterExecutionChange(), 250);
  }

  private sweepPending = false;
  private sweepRunning: Promise<void> = Promise.resolve();

  private async sweepAfterExecutionChange(): Promise<void> {
    this.sweepPending = false;
    this.sweepRunning = this.sweepRunning
      .then(() => this.taskExecutionQueuePopulatorService.populateAllTasks())
      .catch((error: unknown) =>
        this.logger.error({
          message: 'Queue re-check after an execution change failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    await this.sweepRunning;
  }

  private async reconcileTask(taskId: string, trigger: string): Promise<void> {
    this.logger.debug({
      message: 'Task execution queue population triggered by event',
      taskId,
      trigger,
    });

    await this.taskExecutionQueuePopulatorService.populateTask(taskId);
  }
}
