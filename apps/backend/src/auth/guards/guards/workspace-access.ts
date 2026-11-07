import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@taico/errors';
import { DEFAULT_WORKSPACE_ID } from '../../../workspaces/workspaces.constants';
import type { AuthContext } from '../context/auth-context.types';
import {
  WORKSPACE_ACCESS_KEY,
  WorkspaceAccessMode,
} from '../decorators/workspace-access.decorator';

/** The entry point is in a workspace the token is not for. Answers 404, like any row of another workspace. */
export class NotInWorkspaceError extends Error {
  readonly code = ErrorCodes.NOT_IN_WORKSPACE;
  constructor() {
    super('Not found');
    this.name = NotInWorkspaceError.name;
  }
}

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
  if (mode === 'default-only' && auth.workspaceId !== DEFAULT_WORKSPACE_ID) {
    throw new NotInWorkspaceError();
  }
}

export function entryPointName(context: ExecutionContext): string {
  return `${context.getClass().name}.${context.getHandler().name}`;
}
