/**
 * Default scopes pre-selected when creating a new agent token.
 * These scopes are sufficient for the worker process that runs this agent.
 */
export const DEFAULT_AGENT_TOKEN_SCOPES = [
  'meta:read',
  'meta:write',
  'tasks:read',
  'tasks:write',
  'context:read',
  'context:write',
  'agents:read',
  'run:read',
  'run:write',
  'threads:read',
  'threads:write',
  'mcp-registry:read',
  'mcp:use',
  'secret:read',
] as const;
