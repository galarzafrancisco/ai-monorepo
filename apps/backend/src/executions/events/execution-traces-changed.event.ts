export class ExecutionTracesChangedEvent {
  static readonly INTERNAL = Symbol('executions.ExecutionTracesChangedEvent');
  constructor(readonly executionId: string) {}
}
