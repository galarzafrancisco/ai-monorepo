import type { ErrorCode } from './error-codes.js';

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  context?: Record<string, unknown>;
  instance?: string;
  requestId: string;
  retryable?: boolean;
};
