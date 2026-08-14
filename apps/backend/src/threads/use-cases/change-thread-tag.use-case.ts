import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadNotFoundError } from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';

@Injectable()
export class ChangeThreadTagUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async add(threadId: string, tagName: string, actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ThreadEntity);
      const thread = await this.load(repository, threadId);
      const [tag] = await this.tagWriter.findOrCreate(manager, [tagName]);
      if (!tag) throw new Error('A tag name is required');
      if (!thread.tags.some((existing) => existing.id === tag.id)) {
        thread.tags.push(tag);
        await repository.save(thread);
        await this.tagWriter.incrementUsage(manager, [tag.id]);
      }
      await this.enqueueUpdate(manager, threadId, actorId);
    });
  }

  async remove(
    threadId: string,
    tagId: string,
    actorId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ThreadEntity);
      const thread = await this.load(repository, threadId);
      if (thread.tags.some((tag) => tag.id === tagId)) {
        thread.tags = thread.tags.filter((tag) => tag.id !== tagId);
        await repository.save(thread);
        await this.tagWriter.cleanupOrphaned(manager, tagId);
      }
      await this.enqueueUpdate(manager, threadId, actorId);
    });
  }

  private async load(
    repository: Repository<ThreadEntity>,
    threadId: string,
  ): Promise<ThreadEntity> {
    const thread = await repository.findOne({
      where: { id: threadId },
      relations: ['tags'],
    });
    if (!thread) throw new ThreadNotFoundError(threadId);
    return thread;
  }

  private async enqueueUpdate(
    manager: EntityManager,
    threadId: string,
    actorId: string,
  ): Promise<void> {
    await this.outboxWriter.enqueue(manager, {
      type: OutboxEventTypes.THREAD_UPDATED,
      actorId,
      aggregateType: 'thread',
      aggregateId: threadId,
      payload: { threadId, actorId },
    });
  }
}
