import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const WikirooErrorCodes = {
  PAGE_NOT_FOUND: ErrorCodes.PAGE_NOT_FOUND,
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
