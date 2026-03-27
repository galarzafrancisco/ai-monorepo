import { AgentsScopes } from 'src/agents/agents.scopes';
import { ContextScopes } from 'src/context/context.scopes';
import { MetaScopes } from 'src/meta/meta.scopes';
import { TasksScopes } from 'src/tasks/tasks.scopes';
import { Scope } from '../types/scope.type';

export const INTERNAL_WORKER_AUTH_TARGET_ID = 'taico-worker';

export const INTERNAL_WORKER_AUTH_TARGET_NAME = 'Taico Worker';

export const INTERNAL_WORKER_AUTH_TARGET_DESCRIPTION =
  'Internal OAuth target for Taico worker bootstrap.';

export const INTERNAL_WORKER_AUTH_SCOPES: Scope[] = [
  AgentsScopes.READ,
  AgentsScopes.ACT_AS,
  TasksScopes.READ,
  MetaScopes.READ,
  ContextScopes.READ,
];
