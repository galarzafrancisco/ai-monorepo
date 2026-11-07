import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExecutionActivityEvent } from './events/execution-activity.events';
import { TaskActivityEvent } from '../tasks/events/tasks.events';
import { TaskEntity } from '../tasks/task.entity';

/** How many task → workspace lookups are remembered. */
const WORKSPACE_CACHE_SIZE = 1000;

@Injectable()
export class TaskActivityProjectionService {
  /**
   * A task never changes workspace, and activity comes in bursts for the same
   * few tasks, so the lookup is remembered. Phase 3c gives executions their own
   * workspace and this lookup goes away.
   */
  private readonly workspaceByTaskId = new Map<string, string>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  @OnEvent(ExecutionActivityEvent.INTERNAL, { async: true })
  async handleExecutionActivity(event: ExecutionActivityEvent): Promise<void> {
    const workspaceId = await this.workspaceOfTask(event.payload.taskId);
    if (!workspaceId) return;

    this.eventEmitter.emit(
      TaskActivityEvent.INTERNAL,
      new TaskActivityEvent(
        { id: event.actor.id },
        {
          workspaceId,
          taskId: event.payload.taskId,
          kind: event.payload.kind,
          message: event.payload.message,
          ts: event.payload.ts,
          by: event.payload.executionId,
        },
      ),
    );
  }

  private async workspaceOfTask(taskId: string): Promise<string | null> {
    const cached = this.workspaceByTaskId.get(taskId);
    if (cached) return cached;

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      select: { id: true, workspaceId: true },
      withDeleted: true,
    });
    if (!task) return null;

    if (this.workspaceByTaskId.size >= WORKSPACE_CACHE_SIZE) {
      // Forget the oldest entry (Maps keep insertion order).
      const oldest = this.workspaceByTaskId.keys().next().value;
      if (oldest !== undefined) this.workspaceByTaskId.delete(oldest);
    }
    this.workspaceByTaskId.set(taskId, task.workspaceId);
    return task.workspaceId;
  }
}
