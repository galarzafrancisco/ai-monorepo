import { ErrorCodes, type ProblemDetails } from "@taico/errors";

export const toProblem = (p: Partial<ProblemDetails>): ProblemDetails => ({
  type: p.type ?? '/errors/internal',
  title: p.title ?? 'Internal Server Error',
  status: p.status ?? 500,
  code: p.code ?? ErrorCodes.INTERNAL_ERROR,
  detail: p.detail,
  context: p.context,
  instance: p.instance,
  requestId: p.requestId ?? 'unknown',
  retryable: p.retryable ?? false,
});
