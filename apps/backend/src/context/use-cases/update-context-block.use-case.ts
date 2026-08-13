import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { UpdateBlockInput } from '../dto/service/context.service.types';
import {
  BlockNotFoundError,
  CircularReferenceError,
  ParentBlockNotFoundError,
} from '../errors/context.errors';

@Injectable()
export class UpdateContextBlockUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    blockId: string,
    input: UpdateBlockInput,
  ): Promise<ContextBlockEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      const block = await this.load(repository, blockId);
      if (input.parentId !== undefined) {
        if (input.parentId === blockId) throw new CircularReferenceError();
        if (input.parentId !== null) {
          const parent = await repository.findOne({
            where: { id: input.parentId },
          });
          if (!parent) throw new ParentBlockNotFoundError(input.parentId);
          await this.assertNoCycle(repository, blockId, input.parentId);
        }
        block.parentId = input.parentId;
      }
      if (input.title !== undefined) block.title = input.title;
      if (input.content !== undefined) block.content = input.content;
      if (input.order !== undefined) block.order = input.order;
      if (input.tagNames !== undefined) {
        block.tags = input.tagNames.length
          ? await this.tagWriter.findOrCreate(manager, input.tagNames)
          : [];
      }
      await repository.save(block);
      const updated = await this.load(repository, blockId);
      const actorId = input.actorId ?? updated.createdByActorId;
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
        actorId,
        aggregateType: 'context-block',
        aggregateId: blockId,
        payload: { blockId, actorId },
      });
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

  private async assertNoCycle(
    repository: Repository<ContextBlockEntity>,
    blockId: string,
    parentId: string,
  ): Promise<void> {
    let currentId: string | null | undefined = parentId;
    while (currentId) {
      if (currentId === blockId) throw new CircularReferenceError();
      const current = await repository.findOne({ where: { id: currentId } });
      if (!current) return;
      currentId = current.parentId;
    }
  }
}
