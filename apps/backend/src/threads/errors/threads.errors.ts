import { ErrorCodes } from '@taico/errors';

// Domain errors: the problem-details filter maps each `code` to its HTTP status.

export class ThreadNotFoundError extends Error {
  readonly code = ErrorCodes.THREAD_NOT_FOUND;
  constructor(threadId: string) {
    super(`Thread with ID ${threadId} not found`);
    this.name = 'ThreadNotFoundError';
  }
}

export class TaskNotFoundForThreadError extends Error {
  readonly code = ErrorCodes.TASK_NOT_FOUND;
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`);
    this.name = 'TaskNotFoundForThreadError';
  }
}

export class ContextBlockNotFoundError extends Error {
  readonly code = ErrorCodes.PAGE_NOT_FOUND;
  constructor(blockId: string) {
    super(`Context block with ID ${blockId} not found`);
    this.name = 'ContextBlockNotFoundError';
  }
}

export class ActorNotFoundForThreadError extends Error {
  readonly code = ErrorCodes.THREAD_ACTOR_NOT_FOUND;
  constructor(actorId: string) {
    super(`Actor with ID ${actorId} not found`);
    this.name = 'ActorNotFoundForThreadError';
  }
}

export class ParentTaskThreadAlreadyExistsError extends Error {
  readonly code = ErrorCodes.THREAD_PARENT_TASK_CONFLICT;
  constructor(parentTaskId: string) {
    super(`A thread already exists for parent task ID ${parentTaskId}`);
    this.name = 'ParentTaskThreadAlreadyExistsError';
  }
}

export class InvalidThreadTitleError extends Error {
  readonly code = ErrorCodes.INVALID_THREAD_TITLE;

  constructor() {
    super('Thread title must not be empty');
    this.name = 'InvalidThreadTitleError';
  }
}
