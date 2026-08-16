import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../../threads/thread.entity';
import { ContextBlockEntity } from '../block.entity';
import {
  BlockHasChildrenError,
  BlockIsThreadStateError,
  BlockNotFoundError,
} from '../errors/context.errors';

@Injectable()
export class DeleteContextBlockUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(blockId: string, actorId?: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContextBlockEntity);
      const block = await repository.findOne({ where: { id: blockId } });
      if (!block) throw new BlockNotFoundError(blockId);
      const childCount = await repository.count({
        where: { parentId: blockId },
      });
      if (childCount > 0) throw new BlockHasChildrenError(blockId, childCount);
      const threadCount = await manager.getRepository(ThreadEntity).count({
        where: { stateContextBlockId: blockId },
      });
      if (threadCount > 0)
        throw new BlockIsThreadStateError(blockId, threadCount);
      await repository.delete(blockId);
      const eventActorId = actorId ?? block.createdByActorId;
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.CONTEXT_BLOCK_DELETED,
        actorId: eventActorId,
        aggregateType: 'context-block',
        aggregateId: blockId,
        payload: { blockId, actorId: eventActorId },
      });
    });
  }
}
