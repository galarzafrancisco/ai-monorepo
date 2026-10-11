import { ErrorCodes } from '@taico/errors';
import { AiModelJob } from '../enums';

export const AiProvidersErrorCodes = {
  AI_PROVIDER_NOT_FOUND: ErrorCodes.AI_PROVIDER_NOT_FOUND,
  AI_PROVIDER_NOT_CONFIGURED: ErrorCodes.AI_PROVIDER_NOT_CONFIGURED,
  AI_PROVIDER_IN_USE: ErrorCodes.AI_PROVIDER_IN_USE,
  AI_PROVIDER_MODEL_LISTING_FAILED: ErrorCodes.AI_PROVIDER_MODEL_LISTING_FAILED,
  AI_MODEL_NOT_SELECTED: ErrorCodes.AI_MODEL_NOT_SELECTED,
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
