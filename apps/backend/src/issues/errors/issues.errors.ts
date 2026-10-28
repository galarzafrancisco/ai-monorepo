import { ErrorCodes } from '@taico/errors';

export const IssuesErrorCodes = {
  ISSUE_NOT_FOUND: ErrorCodes.ISSUE_NOT_FOUND,
  ISSUE_REF_INVALID: ErrorCodes.ISSUE_REF_INVALID,
} as const;

type IssuesErrorCode = (typeof IssuesErrorCodes)[keyof typeof IssuesErrorCodes];

export abstract class IssuesDomainError extends Error {
  constructor(
    message: string,
    readonly code: IssuesErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class IssueNotFoundError extends IssuesDomainError {
  constructor(id: string) {
    super('Issue not found.', IssuesErrorCodes.ISSUE_NOT_FOUND, { id });
  }
}

export class IssueRefInvalidError extends IssuesDomainError {
  constructor(value: string) {
    super(
      `"${value}" is not a GitHub issue. Use a link like https://github.com/owner/repo/issues/12.`,
      IssuesErrorCodes.ISSUE_REF_INVALID,
      { value },
    );
  }
}
