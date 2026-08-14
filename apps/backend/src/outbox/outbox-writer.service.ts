import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';
import { OutboxEventInput } from './outbox-event.types';

@Injectable()
export class OutboxWriterService {
  async enqueue(
    manager: EntityManager,
    input: OutboxEventInput,
  ): Promise<OutboxEventEntity> {
    const repository = manager.getRepository(OutboxEventEntity);
    const now = new Date();
    return repository.save(
      repository.create({
        type: input.type,
        version: input.version ?? 1,
        actorId: input.actorId ?? null,
        aggregateType: input.aggregateType ?? null,
        aggregateId: input.aggregateId ?? null,
        payload: input.payload,
        occurredAt: input.occurredAt ?? now,
        availableAt: input.availableAt ?? now,
        processingStartedAt: null,
        processedAt: null,
        lastError: null,
      }),
    );
  }
}
