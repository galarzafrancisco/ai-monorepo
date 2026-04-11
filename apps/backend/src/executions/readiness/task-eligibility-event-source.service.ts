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

  private async reconcileTask(taskId: string, trigger: string): Promise<void> {
    this.logger.debug({
      message: 'Task execution queue population triggered by event',
      taskId,
      trigger,
    });

    await this.taskExecutionQueuePopulatorService.populateTask(taskId);
  }
}
