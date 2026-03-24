import { ErrorCodes } from '@taico/errors';

export const ChatProvidersErrorCodes = {
  CHAT_PROVIDER_NOT_FOUND: ErrorCodes.CHAT_PROVIDER_NOT_FOUND,
  CHAT_PROVIDER_ALREADY_ACTIVE: ErrorCodes.CHAT_PROVIDER_ALREADY_ACTIVE,
  CHAT_PROVIDER_NOT_CONFIGURED: ErrorCodes.CHAT_PROVIDER_NOT_CONFIGURED,
  NO_ACTIVE_CHAT_PROVIDER: ErrorCodes.NO_ACTIVE_CHAT_PROVIDER,
} as const;

type ChatProvidersErrorCode =
  (typeof ChatProvidersErrorCodes)[keyof typeof ChatProvidersErrorCodes];

export abstract class ChatProvidersDomainError extends Error {
  constructor(
    message: string,
    readonly code: ChatProvidersErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ChatProviderNotFoundError extends ChatProvidersDomainError {
  constructor(providerId: string) {
    super('Chat provider not found.', ChatProvidersErrorCodes.CHAT_PROVIDER_NOT_FOUND, {
      providerId,
    });
  }
}

export class ChatProviderAlreadyActiveError extends ChatProvidersDomainError {
  constructor(providerId: string) {
    super(
      'Another chat provider is already active.',
      ChatProvidersErrorCodes.CHAT_PROVIDER_ALREADY_ACTIVE,
      { providerId },
    );
  }
}

export class ChatProviderNotConfiguredError extends ChatProvidersDomainError {
  constructor(providerId: string) {
    super(
      'Chat provider is not fully configured.',
      ChatProvidersErrorCodes.CHAT_PROVIDER_NOT_CONFIGURED,
      { providerId },
    );
  }
}

export class NoActiveChatProviderError extends ChatProvidersDomainError {
  constructor() {
    super('No active chat provider configured.', ChatProvidersErrorCodes.NO_ACTIVE_CHAT_PROVIDER);
  }
}
