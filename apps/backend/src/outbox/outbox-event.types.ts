import { EntityManager } from 'typeorm';

export type OutboxEventInput = {
  type: string;
  version?: number;
  actorId?: string | null;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payload: Record<string, unknown>;
  occurredAt?: Date;
  availableAt?: Date;
};

export type OutboxEventHandler = (
  event: import('./outbox-event.entity').OutboxEventEntity,
) => Promise<void>;

export type OutboxTransaction = (manager: EntityManager) => Promise<void>;
