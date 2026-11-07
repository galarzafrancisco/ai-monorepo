import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@taico/errors';
import { holdsUnscopedModuleData } from '../../../workspaces/unscoped-modules';
import { NotInWorkspaceError } from '../../../workspaces/workspace.errors';
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

export function entryPointName(context: ExecutionContext): string {
  return `${context.getClass().name}.${context.getHandler().name}`;
}
