import { ExecutionsError, ExecutionsErrorCodes } from '../errors/executions.errors';

export class InvalidExecutionTraceError extends ExecutionsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ExecutionsErrorCodes.INVALID_EXECUTION_TRACE, context);
  }
}
export class ExecutionTraceNotFoundError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution was not found.', ExecutionsErrorCodes.TASK_EXECUTION_NOT_FOUND, { executionId });
  }
}
export class ExecutionTraceWorkerMismatchError extends ExecutionsError {
  constructor(executionId: string) {
    super('Execution belongs to a different worker.', ExecutionsErrorCodes.TASK_EXECUTION_WORKER_MISMATCH, {
      executionId,
    });
  }
}
