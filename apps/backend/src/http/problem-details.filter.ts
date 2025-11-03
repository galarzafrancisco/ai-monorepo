import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { mapDomainError } from '../errors/http/domain-to-problem.mapper';
import { toProblem } from '../errors/http/problem-details';
import { ErrorCodes } from '../../../../packages/shared/errors/error-codes';

/**
 * Global exception filter that maps domain errors to RFC 7807 Problem Details
 * @see https://tools.ietf.org/html/rfc7807
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>() as any;
    const requestId =
      (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const instance = request.url;

    // Domain error: has a string code
    if (exception?.code && typeof exception.code === 'string') {
      const problem = mapDomainError(exception, requestId, instance);

      this.logger.warn({
        message: 'Domain error caught',
        code: exception.code,
        detail: exception.message,
        context: exception.context,
        requestId,
        url: instance,
      });

      response.status(problem.status).json(problem);
      return;
    }

    // NestJS validation errors (class-validator)
    if (
      exception instanceof HttpException &&
      exception.getStatus() === 400 &&
      exception['response']?.message
    ) {
      const problemResponse = toProblem({
        type: '/errors/validation/failed',
        title: 'Validation failed',
        status: 400,
        code: ErrorCodes.VALIDATION_FAILED,
        detail: 'One or more fields are invalid.',
        context: { fields: exception['response'].message },
        requestId,
        instance,
        retryable: false,
      });

      this.logger.warn({
        message: 'Validation error',
        fields: exception['response'].message,
        requestId,
        url: instance,
      });

      response.status(400).json(problemResponse);
      return;
    }

    // NestJS HttpException (fallback for other HTTP errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message || exception.message;

      const problemResponse = toProblem({
        type: '/errors/http',
        title: exception.name,
        status,
        code: ErrorCodes.INTERNAL_ERROR,
        detail: message,
        requestId,
        instance,
        retryable: status >= 500,
      });

      this.logger.error({
        message: 'HTTP exception',
        status,
        detail: message,
        requestId,
        url: instance,
      });

      response.status(status).json(problemResponse);
      return;
    }

    // Unknown error → Internal Server Error
    this.logger.error({
      message: 'Unhandled exception',
      error: exception?.message || 'Unknown error',
      stack: exception?.stack,
      requestId,
      url: instance,
    });

    const problemResponse = toProblem({
      type: '/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      code: ErrorCodes.INTERNAL_ERROR,
      detail: 'An unexpected error occurred.',
      requestId,
      instance,
      retryable: true,
    });

    response.status(500).json(problemResponse);
  }
}
