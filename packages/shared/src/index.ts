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
    id: 'agents:read',
    description: 'Allows users to view agents.',
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
    id: 'meta:read',
    description: 'Read meta information (tags, etc.)',
  },
  {
    id: 'context:read',
    description: 'Allows users to read context blocks',
  },
  {
    id: 'workers:connect',
    description: 'Allows worker clients to connect to the Workers WebSocket gateway.',
  },
];
