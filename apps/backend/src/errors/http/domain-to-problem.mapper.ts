import { ErrorCatalog } from './error-catalog';
import { toProblem } from './problem-details';
import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

/**
 * Maps domain errors to RFC 7807 Problem Details
 * Accepts any error with { code, message, context? }
 */
export function mapDomainError(
  e: { code: string; message: string; context?: Record<string, unknown> },
  requestId: string,
  instance?: string,
) {
  const meta = ErrorCatalog[e.code] ?? ErrorCatalog[ErrorCodes.INTERNAL_ERROR];
  return toProblem({
    ...meta,
    code: e.code as any,
    detail: e.message,
    context: e.context,
    requestId,
    instance,
  });
}
