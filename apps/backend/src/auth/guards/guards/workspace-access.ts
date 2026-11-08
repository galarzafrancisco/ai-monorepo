import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@taico/errors';
import { holdsUnscopedModuleData } from '../../../workspaces/unscoped-modules';
import {
  NotInWorkspaceError,
  WorkspaceChangedError,
} from '../../../workspaces/workspace.errors';
import { EXPECTED_WORKSPACE_HEADER } from '../../../workspaces/workspaces.constants';
import type { IncomingHttpHeaders } from 'http';
import type { AuthContext } from '../context/auth-context.types';
import {
  WORKSPACE_ACCESS_KEY,
  WorkspaceAccessMode,
} from '../decorators/workspace-access.decorator';

export { NotInWorkspaceError };

/** A programming error: an authenticated entry point with no `@WorkspaceAccess()`. */
export class WorkspaceAccessUndeclaredError extends Error {
  readonly code = ErrorCodes.WORKSPACE_ACCESS_UNDECLARED;
  constructor(readonly entryPoint: string) {
    super(`${entryPoint} has no @WorkspaceAccess() mode`);
    this.name = WorkspaceAccessUndeclaredError.name;
  }
}

export function workspaceAccessOf(
  reflector: Reflector,
  context: ExecutionContext,
): WorkspaceAccessMode | undefined {
  return reflector.getAllAndOverride<WorkspaceAccessMode>(WORKSPACE_ACCESS_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}

/**
 * The one check behind `@WorkspaceAccess()`, run by the access token guards
 * (HTTP, MCP and WebSocket) once the token is validated. Fails closed: an
 * entry point with no mode is refused. `default-only` entry points answer
 * "not found" to a token for any workspace but the default one.
 */
export function enforceWorkspaceAccess(
  mode: WorkspaceAccessMode | undefined,
  auth: AuthContext,
  entryPoint: string,
): void {
  if (!mode) {
    throw new WorkspaceAccessUndeclaredError(entryPoint);
  }
  if (mode === 'default-only' && !holdsUnscopedModuleData(auth.workspaceId)) {
    throw new NotInWorkspaceError();
  }
}

/**
 * A page that loaded in one workspace sends that workspace's id in
 * `x-taico-workspace`. Session cookies are shared by every tab, so after
 * another tab switches workspace this page's requests would silently run in
 * the new one. Refuse them instead; the web app reloads on this error.
 * Requests without the header (API clients, MCP, workers) are unaffected.
 */
export function enforceExpectedWorkspace(
  headers: IncomingHttpHeaders,
  auth: AuthContext,
): void {
  const expected = headers[EXPECTED_WORKSPACE_HEADER];
  if (expected === undefined) return;
  if (expected !== auth.workspaceId) {
    throw new WorkspaceChangedError();
  }
}

export function entryPointName(context: ExecutionContext): string {
  return `${context.getClass().name}.${context.getHandler().name}`;
}
