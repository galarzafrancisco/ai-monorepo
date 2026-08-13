import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ContextBlockEntity } from '../../context/block.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import {
  ActorNotFoundForThreadError,
  ContextBlockNotFoundError,
  ThreadNotFoundError,
} from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';

@Injectable()
export class ChangeThreadRelationsUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async referenceContextBlock(
    threadId: string,
    blockId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const threadRepository = manager.getRepository(ThreadEntity);
      const blockRepository = manager.getRepository(ContextBlockEntity);
      const thread = await this.load(threadRepository, threadId, [
        'referencedContextBlocks',
      ]);
      const block = await blockRepository.findOne({ where: { id: blockId } });
      if (!block) throw new ContextBlockNotFoundError(blockId);
      if (
        !thread.referencedContextBlocks.some(
          (existing) => existing.id === block.id,
        )
      ) {
        thread.referencedContextBlocks.push(block);
        await threadRepository.save(thread);
      }
      await this.enqueue(manager, thread);
    });
  }

  async unreferenceContextBlock(
    threadId: string,
    blockId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ThreadEntity);
      const thread = await this.load(repository, threadId, [
        'referencedContextBlocks',
      ]);
      if (
        thread.referencedContextBlocks.some((block) => block.id === blockId)
      ) {
        thread.referencedContextBlocks = thread.referencedContextBlocks.filter(
          (block) => block.id !== blockId,
        );
        await repository.save(thread);
      }
      await this.enqueue(manager, thread);
    });
  }

  async addParticipant(threadId: string, actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const threadRepository = manager.getRepository(ThreadEntity);
      const actorRepository = manager.getRepository(ActorEntity);
      const thread = await this.load(threadRepository, threadId, [
        'participants',
      ]);
      const actor = await actorRepository.findOne({ where: { id: actorId } });
      if (!actor) throw new ActorNotFoundForThreadError(actorId);
      if (
        !thread.participants.some((participant) => participant.id === actor.id)
      ) {
        thread.participants.push(actor);
        await threadRepository.save(thread);
      }
      await this.enqueue(manager, thread);
    });
  }

  private async load(
    repository: Repository<ThreadEntity>,
    threadId: string,
    relations: string[],
  ): Promise<ThreadEntity> {
    const thread = await repository.findOne({
      where: { id: threadId },
      relations,
    });
    if (!thread) throw new ThreadNotFoundError(threadId);
    return thread;
  }

  private async enqueue(
    manager: EntityManager,
    thread: ThreadEntity,
  ): Promise<void> {
    await this.outboxWriter.enqueue(manager, {
      type: OutboxEventTypes.THREAD_UPDATED,
      actorId: thread.createdByActorId,
      aggregateType: 'thread',
      aggregateId: thread.id,
      payload: { threadId: thread.id, actorId: thread.createdByActorId },
    });
  }
}
