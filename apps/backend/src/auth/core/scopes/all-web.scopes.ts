import { AgentRunsScopes } from 'src/agent-runs/agent-runs.scopes';
import { Scope } from '../types/scope.type';
import { ALL_API_SCOPES } from './all-api.scopes';
import { UserScopes } from './user.scopes';

const SENSITIVE_SCOPES: readonly Scope[] = [
  UserScopes.ADMIN,
  AgentRunsScopes.IMPERSONATE,
];

const scopeIdToIgnore = SENSITIVE_SCOPES.map(s => s.id);

export const ALL_WEB_SCOPES: readonly Scope[] = [
  ...ALL_API_SCOPES,
].filter(s => !scopeIdToIgnore.includes(s.id));

