import { SetMetadata } from '@nestjs/common';

export const WORKSPACE_ACCESS_KEY = 'workspaceAccess';

/**
 * How an entry point keeps workspaces apart. Every controller and gateway
 * declares one (on the class, or per handler to override it). The access
 * token guards enforce it and refuse an authenticated route that has none
 * (`enforceWorkspaceAccess`). `test/workspace-entry-points.e2e-spec.ts`
 * checks that every route and message handler declares a mode and sweeps
 * each mode with a token for a second workspace.
 *
 * - `scoped`: the handler passes `@CurrentWorkspace()` to the service, which
 *   scopes every query. A row in another workspace answers "not found".
 * - `default-only`: the module has no `workspace_id` yet (phases 3b–3e), so
 *   all its rows belong to the default workspace. A token for any other
 *   workspace answers "not found" before the handler runs. A module moves to
 *   `scoped` in the phase that migrates it.
 * - `worker`: a worker's call on one execution. The guard only checks the
 *   token; the handler must pass the caller to `findWorkerExecution`, which
 *   checks the execution's workspace and that this worker claimed it before
 *   anything is read or written.
 * - `installation`: not workspace data (sign-in, OAuth, JWKS, discovery,
 *   health, installation metadata). Public routes are always this.
 */
export type WorkspaceAccessMode =
  | 'scoped'
  | 'default-only'
  | 'worker'
  | 'installation';

export const WorkspaceAccess = (mode: WorkspaceAccessMode) =>
  SetMetadata(WORKSPACE_ACCESS_KEY, mode);
