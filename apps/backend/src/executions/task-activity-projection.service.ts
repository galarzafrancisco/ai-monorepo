import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExecutionActivityEvent } from './events/execution-activity.events';
import { TaskActivityEvent } from '../tasks/events/tasks.events';
import { TaskEntity } from '../tasks/task.entity';

@Injectable()
export class TaskActivityProjectionService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  @OnEvent(ExecutionActivityEvent.INTERNAL, { async: true })
  async handleExecutionActivity(event: ExecutionActivityEvent): Promise<void> {
    // Phase 3c gives executions their own workspace and this lookup goes away.
    const task = await this.taskRepository.findOne({
      where: { id: event.payload.taskId },
      select: { id: true, workspaceId: true },
      withDeleted: true,
    });
    if (!task) return;

    this.eventEmitter.emit(
      TaskActivityEvent.INTERNAL,
      new TaskActivityEvent(
        { id: event.actor.id },
        {
          workspaceId: task.workspaceId,
          taskId: event.payload.taskId,
          kind: event.payload.kind,
          message: event.payload.message,
          ts: event.payload.ts,
          by: event.payload.executionId,
        },
      ),
    );
  }
}
