import { UNSCOPED_MODULE_WORKSPACE_ID } from './workspaces.constants';
import { NotInWorkspaceError } from './workspace.errors';

/**
 * Routes that are not workspace data yet (auth journeys, OAuth client
 * listing, access-request admin, `/auth/users`, search settings writes and
 * index rebuild) answer only the default workspace. This is the one rule for
 * them: `@WorkspaceAccess('default-only')` applies it at the door. Phase 4
 * moves the installation-wide ones to the installation operator.
 */
export function holdsUnscopedModuleData(workspaceId: string): boolean {
  return workspaceId === UNSCOPED_MODULE_WORKSPACE_ID;
}

/** Throws NotInWorkspace (404) unless the workspace may reach unscoped modules. */
export function assertHoldsUnscopedModuleData(workspaceId: string): void {
  if (!holdsUnscopedModuleData(workspaceId)) {
    throw new NotInWorkspaceError();
  }
}
