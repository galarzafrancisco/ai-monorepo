import { ErrorCodes } from '@taico/errors';

export const SecretsErrorCodes = {
  SECRET_NOT_FOUND: ErrorCodes.SECRET_NOT_FOUND,
  SECRET_NAME_CONFLICT: ErrorCodes.SECRET_NAME_CONFLICT,
} as const;

type SecretsErrorCode = (typeof SecretsErrorCodes)[keyof typeof SecretsErrorCodes];

export abstract class SecretsDomainError extends Error {
  constructor(
    message: string,
    readonly code: SecretsErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SecretNotFoundError extends SecretsDomainError {
  constructor(secretId: string) {
    super('Secret not found.', SecretsErrorCodes.SECRET_NOT_FOUND, {
      secretId,
    });
  }
}

export class SecretNameConflictError extends SecretsDomainError {
  constructor(name: string) {
    super('A secret with this name already exists.', SecretsErrorCodes.SECRET_NAME_CONFLICT, {
      name,
    });
  }
}
