import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { BlockNotFoundError } from '../errors/context.errors';

@Injectable()
export class ChangeContextBlockTagUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async add(
    blockId: string,
    tagName: string,
    actorId: string | undefined,
  ): Promise<ContextBlockEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      const block = await this.load(repository, blockId);
      const [tag] = await this.tagWriter.findOrCreate(manager, [tagName]);
      if (!tag) throw new Error('A tag name is required');
      if (!block.tags.some((existing) => existing.id === tag.id)) {
        block.tags.push(tag);
        await repository.save(block);
        await this.tagWriter.incrementUsage(manager, [tag.id]);
      }
      const updated = await this.load(repository, blockId);
      await this.enqueue(manager, blockId, actorId ?? updated.createdByActorId);
      return updated;
    });
  }

  async remove(
    blockId: string,
    tagId: string,
    actorId: string | undefined,
  ): Promise<ContextBlockEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      const block = await this.load(repository, blockId);
      if (block.tags.some((tag) => tag.id === tagId)) {
        block.tags = block.tags.filter((tag) => tag.id !== tagId);
        await repository.save(block);
        await this.tagWriter.cleanupOrphaned(manager, tagId);
      }
      const updated = await this.load(repository, blockId);
      await this.enqueue(manager, blockId, actorId ?? updated.createdByActorId);
      return updated;
    });
  }

  private async load(
    repository: Repository<ContextBlockEntity>,
    blockId: string,
  ): Promise<ContextBlockEntity> {
    const block = await repository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });
    if (!block) throw new BlockNotFoundError(blockId);
    return block;
  }

  private async enqueue(
    manager: EntityManager,
    blockId: string,
    actorId: string,
  ): Promise<void> {
    await this.outboxWriter.enqueue(manager, {
      type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
      actorId,
      aggregateType: 'context-block',
      aggregateId: blockId,
      payload: { blockId, actorId },
    });
  }
}
