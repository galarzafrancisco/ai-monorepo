import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import {
  BlockNotFoundError,
  CircularReferenceError,
  ParentBlockNotFoundError,
} from '../errors/context.errors';

@Injectable()
export class MoveContextBlockUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    blockId: string,
    newParentId: string | null,
  ): Promise<ContextBlockEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      const block = await this.load(repository, blockId);
      if (newParentId === blockId) throw new CircularReferenceError();
      if (newParentId !== null) {
        const parent = await repository.findOne({
          where: { id: newParentId },
        });
        if (!parent) throw new ParentBlockNotFoundError(newParentId);
        await this.assertNoCycle(repository, blockId, newParentId);
      }

      block.parentId = newParentId;
      block.order = await this.nextSiblingOrder(manager, newParentId);
      await repository.save(block);
      const moved = await this.load(repository, blockId);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
        actorId: moved.createdByActorId,
        aggregateType: 'context-block',
        aggregateId: moved.id,
        payload: { blockId: moved.id, actorId: moved.createdByActorId },
      });
      return moved;
    });
  }

  private async nextSiblingOrder(
    manager: EntityManager,
    parentId: string | null,
  ): Promise<number> {
    const rows: Array<{ maxOrder: number | null }> = await manager.query(
      `SELECT MAX("order") AS "maxOrder"
       FROM "context_blocks"
       WHERE "parent_id" IS ? AND "deleted_at" IS NULL`,
      [parentId],
    );
    return (rows[0]?.maxOrder ?? -1) + 1;
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
