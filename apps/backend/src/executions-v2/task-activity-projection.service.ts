import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ExecutionActivityEvent } from './events/execution-activity.events';
import { TaskActivityEvent } from '../tasks/events/tasks.events';

@Injectable()
export class TaskActivityProjectionService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent(ExecutionActivityEvent.INTERNAL)
  handleExecutionActivity(event: ExecutionActivityEvent): void {
    this.eventEmitter.emit(
      TaskActivityEvent.INTERNAL,
      new TaskActivityEvent(
        { id: event.actor.id },
        {
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
