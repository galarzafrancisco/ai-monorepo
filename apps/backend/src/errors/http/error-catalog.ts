import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const ErrorCatalog: Record<
  string,
  {
    status: number;
    title: string;
    type: string;
    retryable?: boolean;
  }
> = {
  [ErrorCodes.TASK_NOT_FOUND]: {
    status: 404,
    title: 'Task not found',
    type: '/errors/tasks/not-found',
    retryable: false,
  },
  [ErrorCodes.TASK_NOT_ASSIGNED]: {
    status: 400,
    title: 'Task not assigned',
    type: '/errors/tasks/not-assigned',
    retryable: false,
  },
  [ErrorCodes.INVALID_STATUS_TRANSITION]: {
    status: 400,
    title: 'Invalid status transition',
    type: '/errors/tasks/invalid-status-transition',
    retryable: false,
  },
  [ErrorCodes.COMMENT_REQUIRED]: {
    status: 400,
    title: 'Comment required',
    type: '/errors/tasks/comment-required',
    retryable: false,
  },
  [ErrorCodes.VALIDATION_FAILED]: {
    status: 400,
    title: 'Validation failed',
    type: '/errors/validation/failed',
    retryable: false,
  },
  [ErrorCodes.INTERNAL_ERROR]: {
    status: 500,
    title: 'Internal server error',
    type: '/errors/internal',
    retryable: true,
  },
};
