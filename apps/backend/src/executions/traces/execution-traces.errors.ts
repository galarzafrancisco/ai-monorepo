import { ExecutionsError } from '../errors/executions.errors';

export class InvalidExecutionTraceError extends ExecutionsError {}
export class ExecutionTraceNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution was not found.', { executionId });
  }
}
export class ExecutionTraceWorkerMismatchError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution belongs to a different worker.', { executionId });
  }
}
