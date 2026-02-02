import { ErrorCodes } from "@taico/errors";

export const ContextErrorCodes = {
  BLOCK_NOT_FOUND: ErrorCodes.PAGE_NOT_FOUND,
  PARENT_BLOCK_NOT_FOUND: ErrorCodes.PARENT_PAGE_NOT_FOUND,
  CIRCULAR_REFERENCE: ErrorCodes.CIRCULAR_REFERENCE,
} as const;

type ContextErrorCode =
  (typeof ContextErrorCodes)[keyof typeof ContextErrorCodes];

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

export class BlockNotFoundError extends ContextDomainError {
  constructor(blockId: string) {
    super('Context block not found.', ContextErrorCodes.BLOCK_NOT_FOUND, {
      blockId,
    });
  }
}

export class ParentBlockNotFoundError extends ContextDomainError {
  constructor(parentId: string) {
    super(
      `Parent block with ID ${parentId} not found`,
      ContextErrorCodes.PARENT_BLOCK_NOT_FOUND,
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
