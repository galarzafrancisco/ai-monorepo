import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const ContextErrorCodes = {
  PAGE_NOT_FOUND: ErrorCodes.PAGE_NOT_FOUND,
  PARENT_PAGE_NOT_FOUND: ErrorCodes.PARENT_PAGE_NOT_FOUND,
  CIRCULAR_REFERENCE: ErrorCodes.CIRCULAR_REFERENCE,
} as const;

type ContextErrorCode =
  typeof ContextErrorCodes[keyof typeof ContextErrorCodes];

export abstract class ContextDomainError extends Error {
  constructor(
    message: string,
    readonly code: ContextErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PageNotFoundError extends ContextDomainError {
  constructor(pageId: string) {
    super('Context page not found.', ContextErrorCodes.PAGE_NOT_FOUND, {
      pageId,
    });
  }
}

export class ParentPageNotFoundError extends ContextDomainError {
  constructor(parentId: string) {
    super(
      `Parent page with ID ${parentId} not found`,
      ContextErrorCodes.PARENT_PAGE_NOT_FOUND,
      { parentId },
    );
  }
}

export class CircularReferenceError extends ContextDomainError {
  constructor() {
    super(
      'Cannot create circular parent-child relationship',
      ContextErrorCodes.CIRCULAR_REFERENCE,
    );
  }
}
