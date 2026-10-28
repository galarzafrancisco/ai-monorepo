import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ArtefactAddedEvent,
  CommentAddedEvent,
  TaskCreatedEvent,
  TaskUpdatedEvent,
} from '../tasks/events/tasks.events';
import { MessageCreatedEvent } from '../threads/events/threads.events';
import { IssuesService } from './issues.service';
import { IssueReferenceSource } from './enums';
import { IssueReferenceInput } from './dto/service/issues.service.types';

/**
 * Notices links to issues wherever people and agents write them: task links,
 * descriptions and comments, and thread messages. Nobody has to tell Taico a
 * link is an issue.
 */
@Injectable()
export class IssueReferencesListener {
  private readonly logger = new Logger(IssueReferencesListener.name);

  constructor(private readonly issues: IssuesService) {}

  @OnEvent(TaskCreatedEvent.INTERNAL)
  @OnEvent(TaskUpdatedEvent.INTERNAL)
  async onTaskWritten(event: TaskCreatedEvent | TaskUpdatedEvent): Promise<void> {
    const task = event.payload;
    await this.record({
      sourceType: IssueReferenceSource.TASK_DESCRIPTION,
      sourceId: task.id,
      taskId: task.id,
      text: `${task.name ?? ''}\n${task.description ?? ''}`,
    });
  }

  @OnEvent(ArtefactAddedEvent.INTERNAL)
  async onArtefactAdded(event: ArtefactAddedEvent): Promise<void> {
    const artefact = event.payload;
    await this.record({
      sourceType: IssueReferenceSource.TASK_ARTEFACT,
      sourceId: artefact.id,
      taskId: artefact.taskId,
      text: artefact.link,
    });
  }

  @OnEvent(CommentAddedEvent.INTERNAL)
  async onCommentAdded(event: CommentAddedEvent): Promise<void> {
    const comment = event.payload;
    await this.record({
      sourceType: IssueReferenceSource.TASK_COMMENT,
      sourceId: comment.id,
      taskId: comment.taskId,
      text: comment.content,
    });
  }

  @OnEvent(MessageCreatedEvent.INTERNAL)
  async onThreadMessage(event: MessageCreatedEvent): Promise<void> {
    const message = event.payload;
    await this.record({
      sourceType: IssueReferenceSource.THREAD_MESSAGE,
      sourceId: message.id,
      threadId: message.threadId,
      text: message.content,
    });
  }

  private async record({
    text,
    ...source
  }: Omit<IssueReferenceInput, 'refs'> & { text: string | null | undefined }): Promise<void> {
    try {
      const input: IssueReferenceInput = { ...source, refs: await this.issues.extractRefs(text) };
      // A new task or comment without links has nothing to replace: skip the write.
      if (input.refs.length === 0 && input.sourceType !== IssueReferenceSource.TASK_DESCRIPTION) return;
      await this.issues.replaceReferences(input);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to record issue links',
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
