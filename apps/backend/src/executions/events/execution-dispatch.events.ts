export class ExecutionReadyForDispatchEvent {
  static readonly INTERNAL = 'execution.dispatch.ready';

  constructor(public readonly executionId: string) {}
}

export class WorkerAvailableForDispatchEvent {
  static readonly INTERNAL = 'execution.dispatch.worker-available';

  constructor(public readonly sessionId: string) {}
}
