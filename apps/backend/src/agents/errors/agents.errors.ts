import { ErrorCodes } from "@taico/errors";

export const AgentsErrorCodes = {
  AGENT_NOT_FOUND: ErrorCodes.AGENT_NOT_FOUND,
  AGENT_SLUG_CONFLICT: ErrorCodes.AGENT_SLUG_CONFLICT,
  AGENT_TOOL_PERMISSION_NOT_FOUND: ErrorCodes.AGENT_TOOL_PERMISSION_NOT_FOUND,
  VALIDATION_FAILED: ErrorCodes.VALIDATION_FAILED,
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

export class AgentToolPermissionNotFoundError extends AgentsDomainError {
  constructor(actorId: string, serverId: string) {
    super(
      'Agent tool permission not found.',
      AgentsErrorCodes.AGENT_TOOL_PERMISSION_NOT_FOUND,
      { actorId, serverId },
    );
  }
}

export class InvalidAgentToolPermissionScopeError extends AgentsDomainError {
  constructor(serverId: string, invalidScopeIds: string[]) {
    super(
      'One or more granted scopes are invalid for this MCP server.',
      AgentsErrorCodes.VALIDATION_FAILED,
      { serverId, invalidScopeIds },
    );
  }
}
