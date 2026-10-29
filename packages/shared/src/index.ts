export type Scope = {
  id: string;
  description: string;
};

export const INTERNAL_WORKER_AUTH_TARGET_ID = 'taico-worker';
export const INTERNAL_WORKER_AUTH_TARGET_VERSION = '0.0.0';
export const INTERNAL_WORKER_AUTH_TARGET_NAME = 'Taico Worker';
export const INTERNAL_WORKER_AUTH_TARGET_DESCRIPTION =
  'Internal OAuth target for Taico worker bootstrap.';

export const INTERNAL_WORKER_AUTH_SCOPES: Scope[] = [
  {
    id: 'workers:connect',
    description:
      'Allows workers to pick up tasks, work on them, and finish execution.',
  },
  {
    id: 'agents:act_as',
    description: 'Allows clients to request short-lived execution tokens for agents.',
  },
  {
    id: 'tasks:read',
    description: 'Allows users to read tasks, tags, comments, etc from Tasks.',
  },
  {
    id: 'context:read',
    description: 'Allows users to read context blocks',
  },
  {
    id: 'threads:read',
    description: 'Allows users to read threads.',
  },
  {
    id: 'agents:read',
    description: 'Allows users to view agents.',
  },
  {
    id: 'meta:read',
    description: 'Read meta information (tags, etc.)',
  },
  {
    id: 'mcp-registry:read',
    description: 'Allows workers to read MCP server registry metadata.',
  },
];

export const DISPLAY_AUTH_TARGET_ID = 'taico-display';
export const DISPLAY_AUTH_TARGET_VERSION = '0.0.0';
export const DISPLAY_AUTH_TARGET_NAME = 'Taico Display';
export const DISPLAY_AUTH_TARGET_DESCRIPTION =
  'OAuth target for read-only Taico status displays.';

export const DISPLAY_AUTH_SCOPES: Scope[] = [
  {
    id: 'tasks:read',
    description: 'Allows users to read tasks, tags, comments, etc from Tasks.',
  },
  {
    id: 'run:read',
    description: 'Allows reading agent run information.',
  },
  {
    id: 'workers:read',
    description: 'Read workers.',
  },
];

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

export * from './agent-runtime-permissions.js';
import { BASELINE_SYSTEM_TOOL_PROVIDED_IDS } from './agent-runtime-permissions.js';

/**
 * MCP servers that Taico itself serves and authorizes. Their endpoints only
 * accept Taico tokens, so they must keep the `taico` auth type: switching one
 * to `external` would stop workers sending the execution token and cut agents
 * off from the tools.
 */
export const TAICO_AUTH_REQUIRED_MCP_SERVER_PROVIDED_IDS = [
  ...BASELINE_SYSTEM_TOOL_PROVIDED_IDS,
  INTERNAL_WORKER_AUTH_TARGET_ID,
  DISPLAY_AUTH_TARGET_ID,
] as const;

export function mcpServerRequiresTaicoAuth(providedId: string): boolean {
  return (TAICO_AUTH_REQUIRED_MCP_SERVER_PROVIDED_IDS as readonly string[]).includes(
    providedId,
  );
}
