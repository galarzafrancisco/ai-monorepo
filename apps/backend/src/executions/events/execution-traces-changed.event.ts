export class ExecutionTracesChangedEvent {
  static readonly INTERNAL = Symbol('executions.ExecutionTracesChangedEvent');
  constructor(
    readonly workspaceId: string,
    readonly executionId: string,
  ) {}
}
