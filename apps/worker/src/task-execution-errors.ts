export type ExecutionFailureKind = 'retryable' | 'terminal' | 'cancelled';

export type ExecutionErrorCode = 'OUT_OF_QUOTA' | 'UNKNOWN';

const MAX_ERROR_MESSAGE_LENGTH = 1000;

const QUOTA_MESSAGE_PATTERNS: RegExp[] = [
  /quota/i,
  /rate\s*limit/i,
  /credit/i,
  /billing/i,
  /you\s*(?:have|'ve)?\s*hit\s*(?:your\s*)?limit/i,
  /usage\s*limit/i,
];

export class TaskExecutionError extends Error {
  readonly displayMessage: string;

  constructor(
    message: string,
    readonly kind: ExecutionFailureKind,
    readonly errorCode: ExecutionErrorCode = 'UNKNOWN',
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.displayMessage = normalizeExecutionErrorMessage(message);
  }
}

export class RetryableExecutionError extends TaskExecutionError {
  constructor(
    message: string,
    errorCode: ExecutionErrorCode = 'UNKNOWN',
    cause?: unknown,
  ) {
    super(message, 'retryable', errorCode, cause);
  }
}

export class TerminalExecutionError extends TaskExecutionError {
  constructor(
    message: string,
    errorCode: ExecutionErrorCode = 'UNKNOWN',
    cause?: unknown,
  ) {
    super(message, 'terminal', errorCode, cause);
  }
}

export class CancelledExecutionError extends TaskExecutionError {
  constructor(message = 'Execution cancelled.', cause?: unknown) {
    super(message, 'cancelled', 'UNKNOWN', cause);
  }
}

export class AgentReportedError extends RetryableExecutionError {}

export class AgentQuotaExceededError extends RetryableExecutionError {
  constructor(message = 'Agent is out of quota.', cause?: unknown) {
    super(message, 'OUT_OF_QUOTA', cause);
  }
}

export class RunnerProcessError extends RetryableExecutionError {}

export class UnsupportedAgentTypeError extends TerminalExecutionError {}

export class TaskExecutionPreconditionError extends TerminalExecutionError {}

export class StopRequestedError extends CancelledExecutionError {}

export function classifyAgentError(input: {
  message: string;
  rawMessage?: unknown;
}): TaskExecutionError {
  if (QUOTA_MESSAGE_PATTERNS.some((pattern) => pattern.test(input.message))) {
    return new AgentQuotaExceededError(input.message, input.rawMessage);
  }

  return new AgentReportedError(input.message, 'UNKNOWN', input.rawMessage);
}

export function classifyRunnerError(error: unknown): TaskExecutionError {
  if (error instanceof TaskExecutionError) {
    return error;
  }

  return new RunnerProcessError(
    error instanceof Error ? error.message : String(error),
    'UNKNOWN',
    error,
  );
}

function normalizeExecutionErrorMessage(message: string): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1).trimEnd()}…`;
}
