export type ExecutionInterruptPayload = {
  executionId: string;
  workerClientId: string;
};

export class ExecutionInterruptEvent {
  static readonly INTERNAL = Symbol('executions.ExecutionInterruptEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: { id: string },
    public readonly payload: ExecutionInterruptPayload,
  ) {}
}
