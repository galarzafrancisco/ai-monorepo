import { ErrorCodes } from '@taico/errors';

export const IntegrationsErrorCodes = {
  GITHUB_CONNECTION_NOT_FOUND: ErrorCodes.GITHUB_CONNECTION_NOT_FOUND,
  GITHUB_CONNECTION_INVALID: ErrorCodes.GITHUB_CONNECTION_INVALID,
  GITHUB_REQUEST_FAILED: ErrorCodes.GITHUB_REQUEST_FAILED,
} as const;

type IntegrationsErrorCode =
  (typeof IntegrationsErrorCodes)[keyof typeof IntegrationsErrorCodes];

export abstract class IntegrationsDomainError extends Error {
  constructor(
    message: string,
    readonly code: IntegrationsErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class GithubConnectionNotFoundError extends IntegrationsDomainError {
  constructor(connectionId: string) {
    super('GitHub connection not found.', IntegrationsErrorCodes.GITHUB_CONNECTION_NOT_FOUND, {
      connectionId,
    });
  }
}

/** The settings are incomplete, or GitHub rejected the credential. */
export class GithubConnectionInvalidError extends IntegrationsDomainError {
  constructor(message: string) {
    super(message, IntegrationsErrorCodes.GITHUB_CONNECTION_INVALID);
  }
}

/** GitHub answered with an error, or could not be reached. */
export class GithubRequestFailedError extends IntegrationsDomainError {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message, IntegrationsErrorCodes.GITHUB_REQUEST_FAILED, { status });
  }
}
