import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { CreateBlockInput } from '../dto/service/context.service.types';
import { ParentBlockNotFoundError } from '../errors/context.errors';

@Injectable()
export class CreateContextBlockUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(input: CreateBlockInput): Promise<ContextBlockEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      if (input.parentId) {
        const parent = await repository.findOne({
          where: { id: input.parentId },
        });
        if (!parent) throw new ParentBlockNotFoundError(input.parentId);
      }
      const order = await this.nextOrder(manager, input.parentId);
      const tags = input.tagNames?.length
        ? await this.tagWriter.findOrCreate(manager, input.tagNames)
        : [];
      const saved = await repository.save(
        repository.create({
          title: input.title,
          content: input.content,
          createdByActorId: input.createdByActorId,
          parentId: input.parentId,
          order,
          tags,
        }),
      );
      await this.tagWriter.incrementUsage(
        manager,
        tags.map((tag) => tag.id),
      );
      const block = await repository.findOne({
        where: { id: saved.id },
        relations: ['tags', 'createdByActor', 'assigneeActor'],
      });
      if (!block)
        throw new Error(
          `Context block ${saved.id} was not found after creation`,
        );
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.CONTEXT_BLOCK_CREATED,
        actorId: input.createdByActorId,
        aggregateType: 'context-block',
        aggregateId: block.id,
        payload: { blockId: block.id, actorId: input.createdByActorId },
      });
      return block;
    });
  }

  private async nextOrder(
    manager: Parameters<OutboxWriterService['enqueue']>[0],
    parentId: string | null | undefined,
  ): Promise<number> {
    if (parentId === undefined) return 0;
    const rows = (await manager.query(
      parentId === null
        ? 'SELECT COALESCE(MAX("order"), -1) + 1 AS nextOrder FROM context_blocks WHERE parent_id IS NULL'
        : 'SELECT COALESCE(MAX("order"), -1) + 1 AS nextOrder FROM context_blocks WHERE parent_id = ?',
      parentId === null ? [] : [parentId],
    )) as Array<{ nextOrder: number | string }>;
    return Number(rows[0]?.nextOrder ?? 0);
  }
}
