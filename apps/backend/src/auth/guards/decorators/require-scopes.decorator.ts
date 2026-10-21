/**
 * Require OAuth scopes on a handler/class.
 *
 * @RequireScopes('task.read', 'task.write') // default mode=all
 * @RequireScopes({ mode: 'any', scopes: ['task.read', 'task.write'] })
 */
export { REQUIRED_SCOPES_KEY, RequireScopes } from '@taico/auth/nest';
export type {
  RequiredScopes as RequiredScopesMetadata,
  ScopeMode,
} from '@taico/auth';
