import { AgentRunsScopes } from 'src/agent-runs/agent-runs.scopes';
import { WorkersScopes } from 'src/executions/workers.scopes';
import { Scope } from '../types/scope.type';
import { ALL_API_SCOPES } from './all-api.scopes';
import { UserScopes } from './user.scopes';

/**
 * Scopes a browser session must never get just for signing in.
 *
 * - `user:admin` is granted separately, and only to users whose role is admin.
 * - `run:impersonate` lets the holder get agent tokens.
 * - `workers:connect` lets the holder act as a worker: claim queued tasks,
 *   report on executions and get GitHub tokens for them. Only workers,
 *   which sign in through the internal worker auth target, need it.
 */
export const SENSITIVE_WEB_SCOPES: readonly Scope[] = [
  UserScopes.ADMIN,
  AgentRunsScopes.IMPERSONATE,
  WorkersScopes.CONNECT,
];

const scopeIdToIgnore = SENSITIVE_WEB_SCOPES.map((s) => s.id);

export const ALL_WEB_SCOPES: readonly Scope[] = [...ALL_API_SCOPES].filter(
  (s) => !scopeIdToIgnore.includes(s.id),
);
