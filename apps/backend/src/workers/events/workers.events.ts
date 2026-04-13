import { WorkerEntity } from '../worker.entity';

/**
 * Domain events for the Workers domain.
 * These events decouple the service layer from transport concerns (WebSocket, HTTP, etc.)
 *
 * Each event uses a Symbol as its internal identifier to ensure type-safe,
 * non-string-based event emission within the domain layer.
 */

export type EventActor = {
  id: string;
};

export abstract class WorkerDomainEvent<TPayload = unknown> {
  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: EventActor,
    public readonly payload: TPayload,
  ) {}
}

export class WorkerSeenEvent extends WorkerDomainEvent<WorkerEntity> {
  static readonly INTERNAL = Symbol('workers.WorkerSeenEvent');

  constructor(actor: EventActor, worker: WorkerEntity) {
    super(actor, worker);
  }
}
