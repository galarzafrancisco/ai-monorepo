import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  TaskNotFoundError,
  TaskNotAssignedError,
  InvalidStatusTransitionError,
  CommentRequiredError,
} from '../modules/taskeroo/taskeroo.errors';

/**
 * Global exception filter that maps domain errors to RFC 7807 Problem Details
 * @see https://tools.ietf.org/html/rfc7807
 */
@Catch(
  TaskNotFoundError,
  TaskNotAssignedError,
  InvalidStatusTransitionError,
  CommentRequiredError,
)
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(
    error:
      | TaskNotFoundError
      | TaskNotAssignedError
      | InvalidStatusTransitionError
      | CommentRequiredError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (error instanceof TaskNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        type: 'https://taskeroo.api/errors/task-not-found',
        title: 'Task Not Found',
        status: HttpStatus.NOT_FOUND,
        detail: error.message,
        instance: request.url,
        taskId: error.taskId,
      });
      return;
    }

    if (error instanceof TaskNotAssignedError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        type: 'https://taskeroo.api/errors/task-not-assigned',
        title: 'Task Not Assigned',
        status: HttpStatus.BAD_REQUEST,
        detail: error.message,
        instance: request.url,
        taskId: error.taskId,
      });
      return;
    }

    if (error instanceof InvalidStatusTransitionError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        type: 'https://taskeroo.api/errors/invalid-status-transition',
        title: 'Invalid Status Transition',
        status: HttpStatus.BAD_REQUEST,
        detail: error.message,
        instance: request.url,
        currentStatus: error.currentStatus,
        newStatus: error.newStatus,
      });
      return;
    }

    if (error instanceof CommentRequiredError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        type: 'https://taskeroo.api/errors/comment-required',
        title: 'Comment Required',
        status: HttpStatus.BAD_REQUEST,
        detail: error.message,
        instance: request.url,
      });
      return;
    }
  }
}
