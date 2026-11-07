import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import type { Socket } from 'socket.io';
import type { AuthContext } from '../context/auth-context.types';

/**
 * The workspace of the current request, from the access token's
 * `workspace_id` claim (the default workspace when the claim is missing).
 * Works in HTTP controllers (MCP endpoints included) and WebSocket gateway
 * handlers. Pass it to services as a plain argument.
 *
 * @example
 * ```typescript
 * @Get()
 * list(@CurrentWorkspace() workspaceId: string) {
 *   return this.service.list(workspaceId);
 * }
 * ```
 */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    currentWorkspaceId(context),
);

/** What `@CurrentWorkspace()` resolves to; exported for tests. */
export function currentWorkspaceId(context: ExecutionContext): string {
  const auth = getAuthContext(context);
  if (!auth) {
    // Only reachable on a @Public() route or a socket the auth guard did not
    // run on: a programming error, not a client error.
    throw new Error('@CurrentWorkspace() used without an authenticated request');
  }
  return auth.workspaceId;
}

function getAuthContext(context: ExecutionContext): AuthContext | undefined {
  if (context.getType() === 'ws') {
    return context.switchToWs().getClient<Socket>().data?.auth as
      | AuthContext
      | undefined;
  }
  return context.switchToHttp().getResponse<Response>().locals?.auth as
    | AuthContext
    | undefined;
}
