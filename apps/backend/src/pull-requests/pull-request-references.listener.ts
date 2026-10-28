import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ArtefactAddedEvent,
  CommentAddedEvent,
  TaskCreatedEvent,
  TaskUpdatedEvent,
} from '../tasks/events/tasks.events';
import { MessageCreatedEvent } from '../threads/events/threads.events';
import { PullRequestsService } from './pull-requests.service';
import { PullRequestReferenceSource } from './enums';
import { extractPullRequestRefs } from './github/pull-request-ref';
import { PullRequestReferenceInput } from './dto/service/pull-requests.service.types';

/**
 * Notices links to pull requests wherever people and agents write them: task
 * links, descriptions and comments, and thread messages. Nobody has to tell
 * Taico a link is a pull request.
 */
@Injectable()
export class PullRequestReferencesListener {
  private readonly logger = new Logger(PullRequestReferencesListener.name);

  constructor(private readonly pullRequests: PullRequestsService) {}

  @OnEvent(TaskCreatedEvent.INTERNAL)
  @OnEvent(TaskUpdatedEvent.INTERNAL)
  async onTaskWritten(event: TaskCreatedEvent | TaskUpdatedEvent): Promise<void> {
    const task = event.payload;
    await this.record({
      sourceType: PullRequestReferenceSource.TASK_DESCRIPTION,
      sourceId: task.id,
      taskId: task.id,
      refs: extractPullRequestRefs(`${task.name ?? ''}\n${task.description ?? ''}`),
    });
  }

  @OnEvent(ArtefactAddedEvent.INTERNAL)
  async onArtefactAdded(event: ArtefactAddedEvent): Promise<void> {
    const artefact = event.payload;
    await this.record({
      sourceType: PullRequestReferenceSource.TASK_ARTEFACT,
      sourceId: artefact.id,
      taskId: artefact.taskId,
      refs: extractPullRequestRefs(artefact.link),
    });
  }

  @OnEvent(CommentAddedEvent.INTERNAL)
  async onCommentAdded(event: CommentAddedEvent): Promise<void> {
    const comment = event.payload;
    await this.record({
      sourceType: PullRequestReferenceSource.TASK_COMMENT,
      sourceId: comment.id,
      taskId: comment.taskId,
      refs: extractPullRequestRefs(comment.content),
    });
  }

  @OnEvent(MessageCreatedEvent.INTERNAL)
  async onThreadMessage(event: MessageCreatedEvent): Promise<void> {
    const message = event.payload;
    await this.record({
      sourceType: PullRequestReferenceSource.THREAD_MESSAGE,
      sourceId: message.id,
      threadId: message.threadId,
      refs: extractPullRequestRefs(message.content),
    });
  }

  private async record(input: PullRequestReferenceInput): Promise<void> {
    // A new task or comment without links has nothing to replace: skip the write.
    if (input.refs.length === 0 && input.sourceType !== PullRequestReferenceSource.TASK_DESCRIPTION) return;
    try {
      await this.pullRequests.replaceReferences(input);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to record pull request links',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
