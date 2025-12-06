import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const WikirooErrorCodes = {
  PAGE_NOT_FOUND: ErrorCodes.PAGE_NOT_FOUND,
  PARENT_PAGE_NOT_FOUND: ErrorCodes.PARENT_PAGE_NOT_FOUND,
  CIRCULAR_REFERENCE: ErrorCodes.CIRCULAR_REFERENCE,
} as const;

type WikirooErrorCode =
  typeof WikirooErrorCodes[keyof typeof WikirooErrorCodes];

export abstract class WikirooDomainError extends Error {
  constructor(
    message: string,
    readonly code: WikirooErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PageNotFoundError extends WikirooDomainError {
  constructor(pageId: string) {
    super('Wiki page not found.', WikirooErrorCodes.PAGE_NOT_FOUND, {
      pageId,
    });
  }
}

export class ParentPageNotFoundError extends WikirooDomainError {
  constructor(parentId: string) {
    super(
      `Parent page with ID ${parentId} not found`,
      WikirooErrorCodes.PARENT_PAGE_NOT_FOUND,
      { parentId },
    );
  }
}

export class CircularReferenceError extends WikirooDomainError {
  constructor() {
    super(
      'Cannot create circular parent-child relationship',
      WikirooErrorCodes.CIRCULAR_REFERENCE,
    );
  }
}
