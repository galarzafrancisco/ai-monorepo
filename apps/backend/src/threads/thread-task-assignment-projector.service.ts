import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskAssignedEvent } from '../tasks/events/tasks.events';
import { ThreadsService } from './threads.service';

@Injectable()
export class ThreadTaskAssignmentProjectorService {
  constructor(private readonly threadsService: ThreadsService) {}

  @OnEvent(TaskAssignedEvent.INTERNAL)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    const assigneeActorId = event.payload.assigneeActorId;
    if (!assigneeActorId) {
      return;
    }

    const thread = await this.threadsService.findThreadByTaskId(event.payload.id);
    if (!thread) {
      return;
    }

    if (thread.participants.some((participant) => participant.id === assigneeActorId)) {
      return;
    }

    await this.threadsService.addParticipant(thread.id, assigneeActorId);
  }
}
