import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const ChatErrorCodes = {
  SESSION_NOT_FOUND: ErrorCodes.SESSION_NOT_FOUND,
  ADK_SESSION_CREATION_FAILED: ErrorCodes.ADK_SESSION_CREATION_FAILED,
} as const;

export abstract class ChatDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SessionNotFoundError extends ChatDomainError {
  constructor(sessionId: string) {
    super('Chat session not found.', ChatErrorCodes.SESSION_NOT_FOUND, {
      sessionId,
    });
  }
}

export class AdkSessionCreationFailedError extends ChatDomainError {
  constructor(reason: string) {
    super(
      'Failed to create ADK session.',
      ChatErrorCodes.ADK_SESSION_CREATION_FAILED,
      { reason },
    );
  }
}
