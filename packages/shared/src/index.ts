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
