export const ErrorCodes = {
  // Task errors
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_ASSIGNED: 'TASK_NOT_ASSIGNED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  COMMENT_REQUIRED: 'COMMENT_REQUIRED',

  // Generic errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
