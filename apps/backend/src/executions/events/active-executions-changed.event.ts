export class ActiveExecutionsChangedEvent {
  static readonly INTERNAL = Symbol('executions.ActiveExecutionsChangedEvent');

  /** `workspaceId`: the workspace whose executions changed. */
  constructor(
    readonly workspaceId: string,
    readonly occurredAt = new Date(),
  ) {}
}
