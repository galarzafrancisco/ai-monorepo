import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskDeletedEvent, TaskStatusChangedEvent } from '../../tasks/events/tasks.events';
import { ThreadAgentService } from '../agent/thread-agent.service';
import { ThreadTaskSubscriptionsService } from './thread-task-subscriptions.service';

/** Wakes the threads agent when a task one of its threads subscribed to goes to review or is done. */
@Injectable()
export class ThreadTaskSubscriptionNotifierService {
  private readonly logger = new Logger(ThreadTaskSubscriptionNotifierService.name);
  /**
   * Events are handled one at a time, in the order they happened: a task that
   * is done and then pruned must be recorded as done before its deletion is.
   */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly subscriptions: ThreadTaskSubscriptionsService,
    private readonly threadAgentService: ThreadAgentService,
  ) {}

  @OnEvent(TaskStatusChangedEvent.INTERNAL)
  onTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    return this.enqueue(() => this.handleStatusChanged(event));
  }

  @OnEvent(TaskDeletedEvent.INTERNAL)
  onTaskDeleted(event: TaskDeletedEvent): Promise<void> {
    return this.enqueue(() => this.handleDeleted(event));
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(work);
    return this.queue;
  }

  private async handleStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    const task = event.payload;

    try {
      const threadIds = await this.subscriptions.markTriggered({
        id: task.id,
        name: task.name,
        status: task.status,
      });

      // The notification is stored; the turn that delivers it may run on any backend process.
      for (const threadId of threadIds) {
        this.threadAgentService.requestTurn(threadId);
      }
    } catch (error) {
      this.logFailure('Failed to notify threads subscribed to a task', task.id, error);
    }
  }

  private async handleDeleted(event: TaskDeletedEvent): Promise<void> {
    try {
      await this.subscriptions.removeForDeletedTask(event.taskId, event.actor.id);
    } catch (error) {
      this.logFailure('Failed to remove subscriptions to a deleted task', event.taskId, error);
    }
  }

  private logFailure(message: string, taskId: string, error: unknown): void {
    this.logger.warn({
      message,
      taskId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
