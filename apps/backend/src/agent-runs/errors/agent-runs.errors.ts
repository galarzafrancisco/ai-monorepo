import { ErrorCodes } from "@taico/errors";

// Module-scoped re-export of error codes used by AgentRuns
export const AgentRunsErrorCodes = {
  AGENT_RUN_NOT_FOUND: ErrorCodes.AGENT_RUN_NOT_FOUND,
} as const;

type AgentRunsErrorCode =
  (typeof AgentRunsErrorCodes)[keyof typeof AgentRunsErrorCodes];

/**
 * Base class for all AgentRuns domain errors
 * Keeps HTTP concerns out of the domain layer
 */
export abstract class AgentRunsDomainError extends Error {
  constructor(
    message: string,
    readonly code: AgentRunsErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AgentRunNotFoundError extends AgentRunsDomainError {
  constructor(runId: string) {
    super('Agent run not found.', AgentRunsErrorCodes.AGENT_RUN_NOT_FOUND, {
      runId,
    });
  }
}
