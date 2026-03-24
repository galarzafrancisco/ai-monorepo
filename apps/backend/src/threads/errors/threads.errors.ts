import { NotFoundException, ConflictException } from '@nestjs/common';

export class ThreadNotFoundError extends NotFoundException {
  constructor(threadId: string) {
    super(`Thread with ID ${threadId} not found`);
    this.name = 'ThreadNotFoundError';
  }
}

export class TaskNotFoundForThreadError extends NotFoundException {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`);
    this.name = 'TaskNotFoundForThreadError';
  }
}

export class ContextBlockNotFoundError extends NotFoundException {
  constructor(blockId: string) {
    super(`Context block with ID ${blockId} not found`);
    this.name = 'ContextBlockNotFoundError';
  }
}

export class ActorNotFoundForThreadError extends NotFoundException {
  constructor(actorId: string) {
    super(`Actor with ID ${actorId} not found`);
    this.name = 'ActorNotFoundForThreadError';
  }
}

export class ParentTaskThreadAlreadyExistsError extends ConflictException {
  constructor(parentTaskId: string) {
    super(`A thread already exists for parent task ID ${parentTaskId}`);
    this.name = 'ParentTaskThreadAlreadyExistsError';
  }
}
