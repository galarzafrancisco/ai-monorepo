import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEventEntity } from '../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../outbox/outbox-event-types';
import { ContextBlockEntity } from './block.entity';
import {
  BlockCreatedEvent,
  BlockDeletedEvent,
  BlockUpdatedEvent,
} from './events/context.events';

@Injectable()
export class ContextOutboxProjectorService {
  constructor(
    @InjectRepository(ContextBlockEntity)
    private readonly blockRepository: Repository<ContextBlockEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OutboxEventTypes.CONTEXT_BLOCK_CREATED)
  async projectCreated(event: OutboxEventEntity): Promise<void> {
    const blockId = this.requiredString(event.payload.blockId, 'blockId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });
    if (!block) {
      throw new Error(
        `Outbox context event references missing block ${blockId}`,
      );
    }
    this.eventEmitter.emit(
      BlockCreatedEvent.INTERNAL,
      new BlockCreatedEvent(block, { id: actorId }),
    );
  }

  @OnEvent(OutboxEventTypes.CONTEXT_BLOCK_UPDATED)
  async projectUpdated(event: OutboxEventEntity): Promise<void> {
    const blockId = this.requiredString(event.payload.blockId, 'blockId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const block = await this.loadBlock(blockId);
    this.eventEmitter.emit(
      BlockUpdatedEvent.INTERNAL,
      new BlockUpdatedEvent(block, { id: actorId }),
    );
  }

  @OnEvent(OutboxEventTypes.CONTEXT_BLOCK_DELETED)
  projectDeleted(event: OutboxEventEntity): void {
    const blockId = this.requiredString(event.payload.blockId, 'blockId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    this.eventEmitter.emit(
      BlockDeletedEvent.INTERNAL,
      new BlockDeletedEvent(blockId, { id: actorId }),
    );
  }

  private async loadBlock(blockId: string): Promise<ContextBlockEntity> {
    const block = await this.blockRepository.findOne({
      where: { id: blockId },
      relations: ['tags', 'createdByActor', 'assigneeActor'],
    });
    if (!block) {
      throw new Error(
        `Outbox context event references missing block ${blockId}`,
      );
    }
    return block;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Outbox context event has invalid ${field}`);
    }
    return value;
  }
}
