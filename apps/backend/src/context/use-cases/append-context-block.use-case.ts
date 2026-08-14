import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ContextBlockEntity } from '../block.entity';
import { AppendBlockInput } from '../dto/service/context.service.types';
import { BlockNotFoundError } from '../errors/context.errors';

@Injectable()
export class AppendContextBlockUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    blockId: string,
    input: AppendBlockInput,
  ): Promise<ContextBlockEntity> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.query(
        'UPDATE context_blocks SET content = content || ? WHERE id = ?',
        [`\n${input.content}`, blockId],
      );
      const affected = Array.isArray(result)
        ? result[1]?.changes
        : result?.changes;
      if (typeof affected === 'number' && affected === 0) {
        throw new BlockNotFoundError(blockId);
      }
      const repository = manager.getRepository(ContextBlockEntity);
      const block = await repository.findOne({
        where: { id: blockId },
        relations: ['tags', 'createdByActor', 'assigneeActor'],
      });
      if (!block) throw new BlockNotFoundError(blockId);
      const actorId = input.actorId ?? block.createdByActorId;
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.CONTEXT_BLOCK_UPDATED,
        actorId,
        aggregateType: 'context-block',
        aggregateId: blockId,
        payload: { blockId, actorId },
      });
      return block;
    });
  }
}
