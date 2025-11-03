import { ProblemDetails } from '../../../../../packages/shared/errors/problem-details.type';
import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

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
