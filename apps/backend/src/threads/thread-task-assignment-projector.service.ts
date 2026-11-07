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

    // The task's workspace is the thread's: TasksService checked the assignee
    // is a member of it.
    const workspaceId = event.payload.workspaceId;
    const thread = await this.threadsService.findThreadByTaskIdInWorkspace(
      workspaceId,
      event.payload.id,
    );
    if (!thread) {
      return;
    }

    if (thread.participants.some((participant) => participant.id === assigneeActorId)) {
      return;
    }

    await this.threadsService.addParticipant(workspaceId, thread.id, assigneeActorId);
  }
}
