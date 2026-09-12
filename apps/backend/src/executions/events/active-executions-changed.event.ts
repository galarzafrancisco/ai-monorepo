export class ActiveExecutionsChangedEvent {
  static readonly INTERNAL = Symbol('executions.ActiveExecutionsChangedEvent');

  constructor(readonly occurredAt = new Date()) {}
}
