import { ErrorCodes } from '@taico/errors';
import { AiModelJob } from '../enums';

export const AiProvidersErrorCodes = {
  AI_PROVIDER_NOT_FOUND: ErrorCodes.AI_PROVIDER_NOT_FOUND,
  AI_PROVIDER_NOT_CONFIGURED: ErrorCodes.AI_PROVIDER_NOT_CONFIGURED,
  AI_PROVIDER_IN_USE: ErrorCodes.AI_PROVIDER_IN_USE,
  AI_PROVIDER_MODEL_LISTING_FAILED: ErrorCodes.AI_PROVIDER_MODEL_LISTING_FAILED,
  AI_MODEL_NOT_SELECTED: ErrorCodes.AI_MODEL_NOT_SELECTED,
  AI_PROVIDER_TYPE_DISABLED: ErrorCodes.AI_PROVIDER_TYPE_DISABLED,
  AI_PROVIDER_ALREADY_EXISTS: ErrorCodes.AI_PROVIDER_ALREADY_EXISTS,
  AI_PROVIDER_JOB_NOT_ALLOWED: ErrorCodes.AI_PROVIDER_JOB_NOT_ALLOWED,
  AI_PROVIDER_CONNECTION_NOT_SUPPORTED: ErrorCodes.AI_PROVIDER_CONNECTION_NOT_SUPPORTED,
  AI_PROVIDER_CONNECTION_REQUIRED: ErrorCodes.AI_PROVIDER_CONNECTION_REQUIRED,
  AI_PROVIDER_CONNECTION_CONSENT_REQUIRED: ErrorCodes.AI_PROVIDER_CONNECTION_CONSENT_REQUIRED,
  AI_PROVIDER_AUTHORIZATION_FAILED: ErrorCodes.AI_PROVIDER_AUTHORIZATION_FAILED,
  AI_PROVIDER_REQUEST_FAILED: ErrorCodes.AI_PROVIDER_REQUEST_FAILED,
} as const;

type AiProvidersErrorCode =
  (typeof AiProvidersErrorCodes)[keyof typeof AiProvidersErrorCodes];

export abstract class AiProvidersDomainError extends Error {
  constructor(
    message: string,
    readonly code: AiProvidersErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AiProviderNotFoundError extends AiProvidersDomainError {
  constructor(providerId: string) {
    super('AI provider not found.', AiProvidersErrorCodes.AI_PROVIDER_NOT_FOUND, {
      providerId,
    });
  }
}

export class AiProviderNotConfiguredError extends AiProvidersDomainError {
  constructor(providerId: string) {
    super(
      'AI provider is not fully configured.',
      AiProvidersErrorCodes.AI_PROVIDER_NOT_CONFIGURED,
      { providerId },
    );
  }
}

export class AiProviderInUseError extends AiProvidersDomainError {
  constructor(providerId: string, jobs: AiModelJob[]) {
    super(
      `AI provider is still selected for: ${jobs.join(', ')}. Pick another model for those first.`,
      AiProvidersErrorCodes.AI_PROVIDER_IN_USE,
      { providerId, jobs },
    );
  }
}

export class AiProviderModelListingFailedError extends AiProvidersDomainError {
  constructor(providerId: string, reason: string) {
    super(
      `Could not list models from the provider: ${reason}`,
      AiProvidersErrorCodes.AI_PROVIDER_MODEL_LISTING_FAILED,
      { providerId },
    );
  }
}

export class AiModelNotSelectedError extends AiProvidersDomainError {
  constructor(job: AiModelJob) {
    super(`No model is selected for ${job}.`, AiProvidersErrorCodes.AI_MODEL_NOT_SELECTED, {
      job,
    });
  }
}

export class AiProviderTypeDisabledError extends AiProvidersDomainError {
  constructor(type: string, reason: string) {
    super(reason, AiProvidersErrorCodes.AI_PROVIDER_TYPE_DISABLED, { type });
  }
}

export class AiProviderAlreadyExistsError extends AiProvidersDomainError {
  constructor(type: string) {
    super(
      'A provider of this type already exists. Each person connects their own account to it.',
      AiProvidersErrorCodes.AI_PROVIDER_ALREADY_EXISTS,
      { type },
    );
  }
}

/** A provider that runs on a person's own plan was asked to do something other than answer in a thread. */
export class AiProviderJobNotAllowedError extends AiProvidersDomainError {
  constructor(providerId: string, job: AiModelJob) {
    super(
      `This provider uses a person's own plan and cannot be used for ${job}, because that job does not say whose plan would pay.`,
      AiProvidersErrorCodes.AI_PROVIDER_JOB_NOT_ALLOWED,
      { providerId, job },
    );
  }
}

export class AiProviderConnectionNotSupportedError extends AiProvidersDomainError {
  constructor(providerId: string) {
    super(
      'This provider is set up with shared credentials, not personal connections.',
      AiProvidersErrorCodes.AI_PROVIDER_CONNECTION_NOT_SUPPORTED,
      { providerId },
    );
  }
}

/** The person a request would run for has no usable connection. Never answered by another provider. */
export class AiProviderConnectionRequiredError extends AiProvidersDomainError {
  constructor(providerId: string, message: string, context?: Record<string, unknown>) {
    super(message, AiProvidersErrorCodes.AI_PROVIDER_CONNECTION_REQUIRED, {
      providerId,
      ...context,
    });
  }
}

export class AiProviderConnectionConsentRequiredError extends AiProvidersDomainError {
  constructor(providerId: string, message: string) {
    super(message, AiProvidersErrorCodes.AI_PROVIDER_CONNECTION_CONSENT_REQUIRED, {
      providerId,
    });
  }
}

export class AiProviderAuthorizationFailedError extends AiProvidersDomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, AiProvidersErrorCodes.AI_PROVIDER_AUTHORIZATION_FAILED, context);
  }
}

/** The provider answered with an error. `context.upstreamCode` is the provider's own code. */
export class AiProviderRequestFailedError extends AiProvidersDomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, AiProvidersErrorCodes.AI_PROVIDER_REQUEST_FAILED, context);
  }

  get upstreamCode(): string | null {
    const code = this.context?.upstreamCode;
    return typeof code === 'string' ? code : null;
  }
}
