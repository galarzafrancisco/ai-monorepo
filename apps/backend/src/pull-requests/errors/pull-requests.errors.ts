import { ErrorCodes } from '@taico/errors';

export const PullRequestsErrorCodes = {
  PULL_REQUEST_NOT_FOUND: ErrorCodes.PULL_REQUEST_NOT_FOUND,
  PULL_REQUEST_REF_INVALID: ErrorCodes.PULL_REQUEST_REF_INVALID,
} as const;

type PullRequestsErrorCode = (typeof PullRequestsErrorCodes)[keyof typeof PullRequestsErrorCodes];

export abstract class PullRequestsDomainError extends Error {
  constructor(
    message: string,
    readonly code: PullRequestsErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PullRequestNotFoundError extends PullRequestsDomainError {
  constructor(id: string) {
    super('Pull request not found.', PullRequestsErrorCodes.PULL_REQUEST_NOT_FOUND, { id });
  }
}

export class PullRequestRefInvalidError extends PullRequestsDomainError {
  constructor(value: string) {
    super(
      `"${value}" is not a GitHub pull request. Use a link like https://github.com/owner/repo/pull/12 or owner/repo#12.`,
      PullRequestsErrorCodes.PULL_REQUEST_REF_INVALID,
      { value },
    );
  }
}
