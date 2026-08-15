import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEventEntity } from '../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../outbox/outbox-event-types';
import {
  ThreadCreatedEvent,
  ThreadDeletedEvent,
  ThreadUpdatedEvent,
  MessageCreatedEvent,
} from './events/threads.events';
import { ThreadMessageEntity } from './thread-message.entity';
import { ThreadEntity } from './thread.entity';
import { ThreadTitleWorkflowService } from './thread-title-workflow.service';

@Injectable()
export class ThreadOutboxProjectorService {
  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(ThreadMessageEntity)
    private readonly messageRepository: Repository<ThreadMessageEntity>,
    private readonly threadTitleWorkflow: ThreadTitleWorkflowService,
  ) {}

  @OnEvent(OutboxEventTypes.THREAD_CREATED)
  async projectCreated(event: OutboxEventEntity): Promise<void> {
    const threadId = this.requiredString(event.payload.threadId, 'threadId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const thread = await this.loadThread(threadId);
    if (thread.parentTaskId) {
      if (!thread.parentTask) {
        throw new Error(
          `Thread ${threadId} is missing parent task ${thread.parentTaskId}`,
        );
      }
      await this.threadTitleWorkflow.generateFromParentTask(
        thread,
        actorId,
        thread.parentTask,
      );
    }
    this.eventEmitter.emit(
      ThreadCreatedEvent.INTERNAL,
      new ThreadCreatedEvent({ id: actorId }, thread),
    );
  }

  @OnEvent(OutboxEventTypes.THREAD_UPDATED)
  async projectUpdated(event: OutboxEventEntity): Promise<void> {
    const threadId = this.requiredString(event.payload.threadId, 'threadId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const thread = await this.loadThread(threadId);
    this.eventEmitter.emit(
      ThreadUpdatedEvent.INTERNAL,
      new ThreadUpdatedEvent({ id: actorId }, thread),
    );
  }

  @OnEvent(OutboxEventTypes.THREAD_MESSAGE_CREATED)
  async projectMessageCreated(event: OutboxEventEntity): Promise<void> {
    const messageId = this.requiredString(event.payload.messageId, 'messageId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['createdByActor'],
    });
    if (!message)
      throw new Error(
        `Outbox thread event references missing message ${messageId}`,
      );
    this.eventEmitter.emit(
      MessageCreatedEvent.INTERNAL,
      new MessageCreatedEvent({ id: actorId }, message),
    );
  }

  private async loadThread(threadId: string): Promise<ThreadEntity> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: [
        'createdByActor',
        'parentTask',
        'tasks',
        'referencedContextBlocks',
        'tags',
        'participants',
      ],
    });
    if (!thread) {
      throw new Error(
        `Outbox thread event references missing thread ${threadId}`,
      );
    }
    return thread;
  }

  @OnEvent(OutboxEventTypes.THREAD_DELETED)
  projectDeleted(event: OutboxEventEntity): void {
    const threadId = this.requiredString(event.payload.threadId, 'threadId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    this.eventEmitter.emit(
      ThreadDeletedEvent.INTERNAL,
      new ThreadDeletedEvent({ id: actorId }, threadId),
    );
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Outbox thread event has invalid ${field}`);
    }
    return value;
  }
}
