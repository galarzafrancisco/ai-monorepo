import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const AgentsErrorCodes = {
  AGENT_NOT_FOUND: ErrorCodes.AGENT_NOT_FOUND,
  AGENT_SLUG_CONFLICT: ErrorCodes.AGENT_SLUG_CONFLICT,
} as const;

export abstract class AgentsDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AgentNotFoundError extends AgentsDomainError {
  constructor(agentId: string) {
    super('Agent not found.', AgentsErrorCodes.AGENT_NOT_FOUND, { agentId });
  }
}

export class AgentSlugConflictError extends AgentsDomainError {
  constructor(slug: string) {
    super(
      'An agent with this slug already exists.',
      AgentsErrorCodes.AGENT_SLUG_CONFLICT,
      { slug },
    );
  }
}
