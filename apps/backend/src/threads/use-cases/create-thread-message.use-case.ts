import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { CreateThreadMessageInput } from '../dto/service/threads.service.types';
import {
  ActorNotFoundForThreadError,
  ThreadNotFoundError,
} from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';
import { ThreadMessageEntity } from '../thread-message.entity';

export type CreatedThreadMessage = {
  thread: ThreadEntity;
  actor: ActorEntity;
  message: ThreadMessageEntity;
  existingMessageCount: number;
};

/** Persists a human message and durable delivery intent before chat work starts. */
@Injectable()
export class CreateThreadMessageUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    input: CreateThreadMessageInput,
  ): Promise<CreatedThreadMessage> {
    return this.dataSource.transaction(async (manager) => {
      const thread = await manager.getRepository(ThreadEntity).findOne({
        where: { id: input.threadId },
      });
      if (!thread) throw new ThreadNotFoundError(input.threadId);
      const actor = await manager.getRepository(ActorEntity).findOne({
        where: { id: input.createdByActorId },
      });
      if (!actor) throw new ActorNotFoundForThreadError(input.createdByActorId);
      const repository = manager.getRepository(ThreadMessageEntity);
      const existingMessageCount = await repository.count({
        where: { threadId: input.threadId },
      });
      const saved = await repository.save(
        repository.create({
          threadId: input.threadId,
          content: input.content,
          createdByActorId: actor.id,
        }),
      );
      const message = await repository.findOne({
        where: { id: saved.id },
        relations: ['createdByActor'],
      });
      if (!message) throw new Error('Failed to reload message after creation');
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.THREAD_MESSAGE_CREATED,
        actorId: actor.id,
        aggregateType: 'thread-message',
        aggregateId: message.id,
        payload: {
          messageId: message.id,
          threadId: thread.id,
          actorId: actor.id,
        },
      });
      return { thread, actor, message, existingMessageCount };
    });
  }
}
