import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';

export type ContextBlockImportEntry = {
  title: string;
  content: string;
  parentEntryIndex: number | null;
};

/** Imports a validated context tree atomically. */
@Injectable()
export class ImportContextBlockTreeUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    entries: ContextBlockImportEntry[],
    createdByActorId: string,
  ): Promise<number> {
    if (entries.length === 0) return 0;
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      const imported: ContextBlockEntity[] = [];
      for (const entry of entries) {
        const parentId =
          entry.parentEntryIndex === null
            ? null
            : imported[entry.parentEntryIndex]?.id;
        if (entry.parentEntryIndex !== null && !parentId) {
          throw new Error(
            'Import entry references a parent that was not imported',
          );
        }
        const block = await repository.save(
          repository.create({
            title: entry.title,
            content: entry.content,
            createdByActorId,
            parentId,
            order: await this.nextOrder(manager, parentId),
            tags: [],
          }),
        );
        imported.push(block);
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.CONTEXT_BLOCK_CREATED,
          actorId: createdByActorId,
          aggregateType: 'context-block',
          aggregateId: block.id,
          payload: { blockId: block.id, actorId: createdByActorId },
        });
      }
      return imported.length;
    });
  }

  private async nextOrder(
    manager: EntityManager,
    parentId: string | null,
  ): Promise<number> {
    const rows: Array<{ nextOrder: number | string }> = await manager.query(
      parentId === null
        ? 'SELECT COALESCE(MAX("order"), -1) + 1 AS nextOrder FROM context_blocks WHERE parent_id IS NULL'
        : 'SELECT COALESCE(MAX("order"), -1) + 1 AS nextOrder FROM context_blocks WHERE parent_id = ?',
      parentId === null ? [] : [parentId],
    );
    return Number(rows[0]?.nextOrder ?? 0);
  }
}
