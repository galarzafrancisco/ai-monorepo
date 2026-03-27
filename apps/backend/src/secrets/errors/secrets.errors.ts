import { ErrorCodes } from '@taico/errors';

export const SecretsErrorCodes = {
  SECRET_NOT_FOUND: ErrorCodes.SECRET_NOT_FOUND,
  SECRET_NAME_CONFLICT: ErrorCodes.SECRET_NAME_CONFLICT,
  SECRET_FEATURE_DISABLED: ErrorCodes.SECRET_FEATURE_DISABLED,
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

export class SecretsFeatureDisabledError extends SecretsDomainError {
  constructor() {
    super(
      'Secrets feature is disabled. Set SECRETS_ENABLED=true, then configure either SECRETS_ENCRYPTION_KEY or ALLOW_PLAINTEXT_SECRETS_INSECURE=true.',
      SecretsErrorCodes.SECRET_FEATURE_DISABLED,
    );
  }
}
